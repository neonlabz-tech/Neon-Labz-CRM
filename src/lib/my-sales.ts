import "server-only";
import { redirect } from "next/navigation";
import { thisWeek } from "./sales-range";
import type { Role } from "./permissions";
import { goalsFor } from "./sales-targets";
import { Payroll } from "@/models/finance";
import { Employee } from "@/models/hrms";
import { User } from "@/models/user";
import { Lead } from "@/models/lead";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";

export const HISTORY_RANGES = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
] as const;

export type HistoryRange = (typeof HISTORY_RANGES)[number]["id"];

export function readHistoryRange(value: string): HistoryRange {
  return HISTORY_RANGES.some((r) => r.id === value) ? (value as HistoryRange) : "month";
}

/** First and last day (YYYY-MM-DD) of the chosen range. */
export function daysOf(range: HistoryRange, today: string): { from: string; to: string } {
  if (range === "today") return { from: today, to: today };
  if (range === "week") return thisWeek(today);
  if (range === "month") return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-31` };
  return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
}

export type DayRow = { date: string; calls: number; answered: number; leads: number; quotations: number; orders: number; sales: number };

type Count = { _id: string; n: number; total?: number };

/** One row per day for a salesperson: calls, new leads, quotations, approved payments and the money collected. */
export async function dailyActivity(username: string, from: string, to: string): Promise<DayRow[]> {
  const between = { $gte: from, $lte: to };
  const [calls, answered, leads, quotes, paid] = await Promise.all([
    Lead.aggregate<Count>([{ $match: { owner: username } }, { $unwind: "$calls" }, { $match: { "calls.date": between } }, { $group: { _id: "$calls.date", n: { $sum: 1 } } }]),
    Lead.aggregate<Count>([{ $match: { owner: username } }, { $unwind: "$calls" }, { $match: { "calls.date": between, "calls.outcome": "Answered" } }, { $group: { _id: "$calls.date", n: { $sum: 1 } } }]),
    Lead.aggregate<Count>([{ $match: { owner: username, date: between } }, { $group: { _id: "$date", n: { $sum: 1 } } }]),
    Quotation.aggregate<Count>([{ $match: { owner: username, date: between } }, { $group: { _id: "$date", n: { $sum: 1 } } }]),
    Payment.aggregate<Count>([{ $match: { owner: username, status: "confirmed", date: between } }, { $group: { _id: "$date", n: { $sum: 1 }, total: { $sum: "$amount" } } }]),
  ]);
  const days = new Map<string, DayRow>();
  const row = (date: string) => {
    let item = days.get(date);
    if (!item) { item = { date, calls: 0, answered: 0, leads: 0, quotations: 0, orders: 0, sales: 0 }; days.set(date, item); }
    return item;
  };
  for (const r of calls) row(r._id).calls = r.n;
  for (const r of answered) row(r._id).answered = r.n;
  for (const r of leads) row(r._id).leads = r.n;
  for (const r of quotes) row(r._id).quotations = r.n;
  for (const r of paid) { const item = row(r._id); item.orders = r.n; item.sales = r.total ?? 0; }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export type Seller = { username: string; name: string; viewing: boolean };

/** A salesperson sees their own numbers. The Super Admin picks a salesperson with ?seller= and only looks. */
export async function sellerFor(user: { role: Role; username: string; fullName?: string }, wanted: string): Promise<Seller> {
  if (user.role === "sales") return { username: user.username, name: user.fullName || user.username, viewing: false };
  const username = wanted.trim().toUpperCase();
  const seller = username ? await User.findOne({ username, role: "sales" }).select("username fullName").lean() : null;
  if (!seller) redirect("/sales-team");
  return { username: seller.username, name: seller.fullName || seller.username, viewing: true };
}

export type Earned = { sales: number; rate: number; earned: number };

/** Commission earned by each salesperson: approved payments in the period times their commission rate. */
export async function commissionEarned(usernames: string[], prefix: string): Promise<Map<string, Earned>> {
  const rows = usernames.length
    ? await Payment.aggregate<{ _id: string; n: number }>([{ $match: { owner: { $in: usernames }, status: "confirmed", ...(prefix ? { date: { $regex: `^${prefix}` } } : {}) } }, { $group: { _id: "$owner", n: { $sum: "$amount" } } }])
    : [];
  const sales = new Map(rows.map((r) => [r._id, r.n]));
  const out = new Map<string, Earned>();
  for (const username of usernames) {
    const { rate } = await goalsFor(username);
    const got = sales.get(username) ?? 0;
    out.set(username, { sales: got, rate, earned: Math.round(got * rate) / 100 });
  }
  return out;
}

/** Payroll records whose commission belongs to a period. Records saved before the commission month existed use their pay month. */
export const commissionIn = (prefix: string) =>
  prefix ? { $or: [{ commissionMonth: { $regex: `^${prefix}` } }, { commissionMonth: { $in: [null, ""] }, month: { $regex: `^${prefix}` } }] } : {};

/** Commission earned by the whole sales team in a period, how much payroll has paid, and what is still payable. */
export async function commissionPayable(prefix: string): Promise<{ earned: number; paid: number; payable: number }> {
  const staff = await User.find({ role: "sales", active: true }).select("username").limit(200).lean();
  const logins = staff.map((u) => u.username);
  const [earned, people] = await Promise.all([commissionEarned(logins, prefix), Employee.find({ username: { $in: logins } }).select("username").lean()]);
  const rows = people.length
    ? await Payroll.aggregate<{ _id: unknown; n: number }>([{ $match: { employee: { $in: people.map((p) => p._id) }, status: "Paid", ...commissionIn(prefix) } }, { $group: { _id: "$employee", n: { $sum: "$commission" } } }])
    : [];
  const paidBy = new Map(rows.map((r) => [String(r._id), r.n]));
  const idOf = new Map(people.map((p) => [p.username, String(p._id)]));
  let total = 0, paid = 0, payable = 0;
  for (const login of logins) {
    const got = earned.get(login)?.earned ?? 0;
    const settled = paidBy.get(idOf.get(login) ?? "") ?? 0;
    total += got;
    paid += settled;
    payable += Math.max(0, Math.round((got - settled) * 100) / 100);
  }
  return { earned: total, paid, payable };
}

const cents = (value: number) => Math.round(value * 100) / 100;

/** Commission that payroll has paid to one salesperson in a period, and the latest pay date. */
export async function commissionPaid(username: string, prefix: string): Promise<{ paid: number; lastDate: string; inPayroll: boolean }> {
  const person = await Employee.findOne({ username }).select("_id").lean();
  if (!person) return { paid: 0, lastDate: "", inPayroll: false };
  const rows = await Payroll.find({ employee: person._id, ...commissionIn(prefix) }).select("commission status date").lean();
  const paidRows = rows.filter((r) => r.status === "Paid");
  return { paid: cents(paidRows.reduce((sum, r) => sum + r.commission, 0)), lastDate: paidRows.map((r) => r.date).sort().at(-1) ?? "", inPayroll: rows.length > 0 };
}

export type Payout = { month: string; sales: number; earned: number; paid: number; status: "Paid" | "Part paid" | "Pending" };

/** Month by month: what a salesperson earned, what payroll paid, and whether it is settled. The latest 12 months with anything in them. */
export async function payoutHistory(username: string): Promise<Payout[]> {
  const { rate } = await goalsFor(username);
  const person = await Employee.findOne({ username }).select("_id").lean();
  const [sold, pay] = await Promise.all([
    Payment.aggregate<{ _id: string; n: number }>([{ $match: { owner: username, status: "confirmed" } }, { $group: { _id: { $substr: ["$date", 0, 7] }, n: { $sum: "$amount" } } }]),
    person ? Payroll.find({ employee: person._id, status: "Paid" }).select("month commissionMonth commission").lean() : Promise.resolve([]),
  ]);
  const months = new Map<string, { sales: number; paid: number }>();
  const slot = (month: string) => months.get(month) ?? months.set(month, { sales: 0, paid: 0 }).get(month)!;
  for (const row of sold) slot(row._id).sales += row.n;
  for (const row of pay) slot(row.commissionMonth || row.month).paid += row.commission;
  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([month, { sales, paid }]) => {
      const earned = cents((sales * rate) / 100);
      const settled = cents(paid);
      return { month, sales, earned, paid: settled, status: earned > 0 && settled >= earned ? "Paid" : settled > 0 ? "Part paid" : "Pending" } as Payout;
    });
}
