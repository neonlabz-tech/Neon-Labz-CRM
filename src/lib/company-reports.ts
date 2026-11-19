import "server-only";
import { formatMoney } from "@/lib/money";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@/lib/issues";
import { PRIORITY, PROJECT_STATUS, TASK_STATUS } from "@/lib/projects";
import { Client } from "@/models/client";
import { Expense, Payroll, Revenue } from "@/models/finance";
import { manualCollections } from "@/lib/manual-sales";
import { Department, Employee, Leave } from "@/models/hrms";
import { Issue } from "@/models/issue";
import { Lead } from "@/models/lead";
import { MarketingInfo } from "@/models/marketing-info";
import { MarketingPlan } from "@/models/marketing-plan";
import { MarketingReport } from "@/models/marketing-report";
import { Package } from "@/models/package";
import { Payment } from "@/models/payment";
import { Project } from "@/models/project";
import { Quotation } from "@/models/quotation";
import { Task } from "@/models/task";

/** The reports the Super Admin can open. Each one covers the dates chosen on the Reports page. */
export const REPORT_TYPES = [
  { id: "sales", title: "Sales & Leads Report", tag: "Sales", description: "Leads by stage, source and salesperson, with the conversion rate." },
  { id: "collections", title: "Payments Report", tag: "Revenue", description: "Confirmed, pending and cancelled payments by method and salesperson." },
  { id: "clients", title: "Clients Report", tag: "CRM", description: "New clients in the period and the work each one bought." },
  { id: "projects", title: "Projects Report", tag: "Delivery", description: "Projects by status and type, with start and due dates." },
  { id: "delivery", title: "Tasks & Issues Report", tag: "Delivery", description: "Tasks due, finished and overdue, and issues reported." },
  { id: "marketing", title: "Marketing Report", tag: "Marketing", description: "Client info documents, content plans and monthly reports made." },
  { id: "profit", title: "Profit & Loss Report", tag: "Finance", description: "Income, expenses and payroll, month by month." },
  { id: "expenses", title: "Expenses Report", tag: "Finance", description: "Every expense in the period, grouped by category." },
  { id: "payroll", title: "Payroll Report", tag: "HR", description: "Salary and commission paid and still to pay." },
  { id: "hr", title: "People & Leaves Report", tag: "HR", description: "Active people by department and the leave taken." },
  { id: "quotes", title: "Quotations & Packages Report", tag: "Sales", description: "Quotations sent, their value, and the active packages." },
] as const;

export type ReportId = (typeof REPORT_TYPES)[number]["id"];
export const isReportId = (value: string): value is ReportId => REPORT_TYPES.some((r) => r.id === value);

export type ReportSection = { heading: string; columns: string[]; rows: string[][]; note?: string };
export type ReportData = { title: string; summary: [string, string][]; sections: ReportSection[] };

const LIMIT = 150;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

type Query = Record<string, string | string[] | undefined>;
const one = (q: Query, key: string) => {
  const v = q[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
};

export type ReportPeriod = { mode: "month" | "year" | "custom"; month: string; year: string; from: string; to: string; label: string };

/** Reads the monthly, yearly or custom dates from the address. With nothing chosen it is the current month. */
export function readReportPeriod(q: Query, today: string): ReportPeriod {
  const mode = (["month", "year", "custom"] as const).find((m) => m === one(q, "period")) ?? "month";
  const year = /^\d{4}$/.test(one(q, "year")) ? one(q, "year") : today.slice(0, 4);
  const month = ISO_MONTH.test(one(q, "month")) ? one(q, "month") : today.slice(0, 7);
  if (mode === "year") return { mode, month, year, from: `${year}-01-01`, to: `${year}-12-31`, label: `Year ${year}` };
  if (mode === "custom") {
    let from = ISO_DAY.test(one(q, "from")) ? one(q, "from") : `${today.slice(0, 7)}-01`;
    let to = ISO_DAY.test(one(q, "to")) ? one(q, "to") : today;
    if (from > to) [from, to] = [to, from];
    return { mode, month, year, from, to, label: `${from} to ${to}` };
  }
  const [y = 0, m = 1] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const name = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return { mode, month, year, from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}`, label: name };
}

const count = (value: number) => String(value);
const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "0%");
const day = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString().slice(0, 10) : "");

/** Counts rows by a key, largest first. */
function tally<T>(list: T[], key: (item: T) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of list) counts.set(key(item) || "Not set", (counts.get(key(item) || "Not set") ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** A list section that stops at LIMIT rows and says so. */
function listing(heading: string, columns: string[], all: string[][]): ReportSection {
  return { heading, columns, rows: all.slice(0, LIMIT), note: all.length > LIMIT ? `Showing the first ${LIMIT} of ${all.length}.` : all.length ? undefined : "Nothing in this period." };
}

const counted = (heading: string, label: string, pairs: [string, number][]): ReportSection => ({
  heading, columns: [label, "Count"], rows: pairs.map(([name, n]) => [name, count(n)]),
  note: pairs.length ? undefined : "Nothing in this period.",
});

type Totals = { _id: string; n: number };

export async function buildReport(id: ReportId, from: string, to: string): Promise<ReportData> {
  const r = { $gte: from, $lte: to };
  const stamp = { $gte: new Date(`${from}T00:00:00.000Z`), $lte: new Date(`${to}T23:59:59.999Z`) };
  const meta = REPORT_TYPES.find((t) => t.id === id)!;
  const title = meta.title;

  if (id === "sales") {
    const leads = await Lead.find({ date: r }).select("leadId business owner source status date").sort({ date: -1 }).limit(5000).lean();
    const converted = leads.filter((l) => l.status === "Converted").length;
    const lost = leads.filter((l) => l.status === "Lost").length;
    const owners = tally(leads, (l) => l.owner).map(([owner, n]): string[] => {
      const won = leads.filter((l) => l.owner === owner && l.status === "Converted").length;
      return [owner, count(n), count(won), percent(won, n)];
    });
    return {
      title,
      summary: [["Leads", count(leads.length)], ["Converted", count(converted)], ["Lost", count(lost)], ["Conversion rate", percent(converted, leads.length)], ["In the pipeline", count(leads.length - converted - lost)]],
      sections: [
        counted("Leads by stage", "Stage", tally(leads, (l) => l.status)),
        counted("Leads by source", "Source", tally(leads, (l) => l.source)),
        { heading: "By salesperson", columns: ["Salesperson", "Leads", "Converted", "Rate"], rows: owners, note: owners.length ? undefined : "Nothing in this period." },
        listing("Leads", ["Date", "Lead", "Business", "Salesperson", "Stage"], leads.map((l) => [l.date, l.leadId, l.business, l.owner, l.status])),
      ],
    };
  }

  if (id === "collections") {
    const pays = await Payment.find({ date: r }).select("saleCode owner clientName amount date type method status").sort({ date: -1 }).limit(5000).lean();
    const sum = (list: typeof pays) => list.reduce((total, p) => total + p.amount, 0);
    const confirmed = pays.filter((p) => p.status === "confirmed");
    const pending = pays.filter((p) => p.status === "pending");
    const group = (key: (p: (typeof pays)[number]) => string): string[][] => {
      const names = [...new Set(confirmed.map((p) => key(p) || "Not set"))];
      return names.map((name) => { const rows = confirmed.filter((p) => (key(p) || "Not set") === name); return [name, count(rows.length), formatMoney(sum(rows))]; });
    };
    return {
      title,
      summary: [["Confirmed", formatMoney(sum(confirmed))], ["Confirmed payments", count(confirmed.length)], ["Waiting for approval", `${pending.length} · ${formatMoney(sum(pending))}`], ["Cancelled", count(pays.filter((p) => p.status === "cancelled").length)]],
      sections: [
        { heading: "Confirmed by method", columns: ["Method", "Payments", "Amount"], rows: group((p) => p.method), note: confirmed.length ? undefined : "Nothing confirmed in this period." },
        { heading: "Confirmed by salesperson", columns: ["Salesperson", "Payments", "Amount"], rows: group((p) => p.owner), note: confirmed.length ? undefined : "Nothing confirmed in this period." },
        listing("Payments", ["Date", "Sale", "Client", "Type", "Method", "Amount", "Status"], pays.map((p) => [p.date, p.saleCode, p.clientName, p.type, p.method || "—", formatMoney(p.amount), p.status])),
      ],
    };
  }

  if (id === "clients") {
    const clients = await Client.find({ approvedAt: stamp }).select("code name service workType salesOwner approvedAt phone").sort({ approvedAt: -1 }).limit(5000).lean();
    const work = (value: string) => ({ software: "Software", marketing: "Marketing", both: "Software + marketing" })[value as "software"] ?? value;
    return {
      title,
      summary: [["New clients", count(clients.length)], ["Software", count(clients.filter((c) => c.workType === "software").length)], ["Marketing", count(clients.filter((c) => c.workType === "marketing").length)], ["Both", count(clients.filter((c) => c.workType === "both").length)]],
      sections: [
        counted("Clients by salesperson", "Salesperson", tally(clients, (c) => c.salesOwner)),
        listing("Clients", ["Approved", "Code", "Client", "Service", "Work", "Salesperson"], clients.map((c) => [day(c.approvedAt), c.code, c.name, c.service || "—", work(c.workType), c.salesOwner])),
      ],
    };
  }

  if (id === "projects") {
    const projects = await Project.find({ $or: [{ startDate: r }, { dueDate: r }] }).select("code name clientName type status startDate dueDate archived").sort({ startDate: -1 }).limit(5000).lean();
    const label = (status: string) => PROJECT_STATUS[status as keyof typeof PROJECT_STATUS] ?? status;
    return {
      title,
      summary: [["Projects", count(projects.length)], ["In progress", count(projects.filter((p) => p.status === "in-progress").length)], ["Completed", count(projects.filter((p) => p.status === "completed").length)], ["On hold", count(projects.filter((p) => p.status === "on-hold").length)]],
      sections: [
        counted("Projects by status", "Status", tally(projects, (p) => label(p.status))),
        counted("Projects by type", "Type", tally(projects, (p) => p.type[0]!.toUpperCase() + p.type.slice(1))),
        listing("Projects", ["Code", "Project", "Client", "Type", "Status", "Start", "Due"], projects.map((p) => [p.code, p.name, p.clientName, p.type, label(p.status), p.startDate || "—", p.dueDate || "—"])),
      ],
    };
  }

  if (id === "delivery") {
    const today = new Date().toISOString().slice(0, 10);
    const [tasks, issues] = await Promise.all([
      Task.find({ dueDate: r }).select("code title department priority status dueDate").limit(5000).lean(),
      Issue.find({ reportedAt: r }).select("code title projectCode status priority type reportedAt").sort({ reportedAt: -1 }).limit(5000).lean(),
    ]);
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today);
    const issueStatus = (value: string) => (ISSUE_STATUSES as Record<string, string>)[value] ?? value;
    const issuePriority = (value: string) => (ISSUE_PRIORITIES as Record<string, string>)[value] ?? value;
    return {
      title,
      summary: [["Tasks due", count(tasks.length)], ["Tasks done", count(done)], ["Overdue", count(overdue.length)], ["Issues reported", count(issues.length)], ["Issues still open", count(issues.filter((i) => i.status !== "closed" && i.status !== "resolved").length)]],
      sections: [
        counted("Tasks by status", "Status", tally(tasks, (t) => TASK_STATUS[t.status as keyof typeof TASK_STATUS] ?? t.status)),
        counted("Tasks by priority", "Priority", tally(tasks, (t) => PRIORITY[t.priority as keyof typeof PRIORITY] ?? t.priority)),
        counted("Tasks by department", "Department", tally(tasks, (t) => t.department)),
        counted("Issues by status", "Status", tally(issues, (i) => issueStatus(i.status))),
        counted("Issues by priority", "Priority", tally(issues, (i) => issuePriority(i.priority))),
        listing("Overdue tasks", ["Task", "Title", "Department", "Due"], overdue.map((t) => [t.code, t.title, t.department, t.dueDate])),
      ],
    };
  }

  if (id === "marketing") {
    const [infos, plans, reports] = await Promise.all([
      MarketingInfo.find({ createdAt: stamp }).select("clientName brandName createdBy createdAt").sort({ createdAt: -1 }).limit(2000).lean(),
      MarketingPlan.find({ createdAt: stamp }).select("clientName title startDate endDate createdBy").sort({ createdAt: -1 }).limit(2000).lean(),
      MarketingReport.find({ startDate: r }).select("clientName title startDate endDate createdBy").sort({ startDate: -1 }).limit(2000).lean(),
    ]);
    return {
      title,
      summary: [["Client info documents", count(infos.length)], ["Content plans", count(plans.length)], ["Marketing reports", count(reports.length)]],
      sections: [
        listing("Client info documents", ["Client", "Brand", "Made by", "Date"], infos.map((i) => [i.clientName, i.brandName || "—", i.createdBy, day(i.createdAt)])),
        listing("Content plans", ["Client", "Plan", "From", "To", "Made by"], plans.map((p) => [p.clientName, p.title, p.startDate || "—", p.endDate || "—", p.createdBy])),
        listing("Marketing reports", ["Client", "Report", "From", "To", "Made by"], reports.map((m) => [m.clientName, m.title || "Monthly report", m.startDate, m.endDate, m.createdBy])),
      ],
    };
  }

  if (id === "profit" || id === "expenses" || id === "payroll") {
    const monthly = (field: string) => [{ $match: { date: r } }, { $group: { _id: { $substr: ["$date", 0, 7] }, n: { $sum: field === "pay" ? { $add: ["$base", "$commission"] } : `$${field}` } } }];
    if (id === "profit") {
      const [sales, manual, spent, paid, manualSold] = await Promise.all([
        Payment.aggregate<Totals>([{ $match: { status: "confirmed", date: r } }, ...monthly("amount").slice(1)]),
        Revenue.aggregate<Totals>(monthly("amount")),
        Expense.aggregate<Totals>(monthly("amount")),
        Payroll.aggregate<Totals>([{ $match: { status: "Paid", date: r } }, ...monthly("pay").slice(1)]),
        manualCollections(r),
      ]);
      const categories = await Expense.aggregate<Totals>([{ $match: { date: r } }, { $group: { _id: "$category", n: { $sum: "$amount" } } }, { $sort: { n: -1 } }]);
      const by = (rows: Totals[]) => new Map(rows.map((x) => [String(x._id), x.n]));
      const [s0, m, e, p] = [by(sales), by(manual), by(spent), by(paid)];
      const ms = by(manualSold);
      // Money collected on manual sales counts as sales income, month by month.
      const s = new Map(s0);
      for (const [k, v] of ms) s.set(k, (s.get(k) ?? 0) + v);
      const months = [...new Set([...s.keys(), ...m.keys(), ...e.keys(), ...p.keys()])].sort();
      const total = (map: Map<string, number>) => [...map.values()].reduce((a, b) => a + b, 0);
      const income = total(s) + total(m);
      const out = total(e) + total(p);
      return {
        title,
        summary: [["Income", formatMoney(income)], ["Expenses", formatMoney(total(e))], ["Salaries paid", formatMoney(total(p))], ["Net profit", formatMoney(income - out)]],
        sections: [
          { heading: "Income", columns: ["Source", "Amount"], rows: [["Project payments", formatMoney(total(s0))], ["Manual sales collected", formatMoney(total(ms))], ["Manual revenue entries", formatMoney(total(m))]] },
          { heading: "Month by month", columns: ["Month", "Income", "Expenses", "Salaries", "Net"], rows: months.map((k) => { const inc = (s.get(k) ?? 0) + (m.get(k) ?? 0); return [k, formatMoney(inc), formatMoney(e.get(k) ?? 0), formatMoney(p.get(k) ?? 0), formatMoney(inc - (e.get(k) ?? 0) - (p.get(k) ?? 0))]; }), note: months.length ? undefined : "Nothing in this period." },
          { heading: "Expenses by category", columns: ["Category", "Amount"], rows: categories.map((c) => [String(c._id), formatMoney(c.n)]), note: categories.length ? undefined : "Nothing in this period." },
        ],
      };
    }
    if (id === "expenses") {
      const expenses = await Expense.find({ date: r }).select("date category description amount").sort({ date: -1 }).limit(5000).lean();
      const totalSpent = expenses.reduce((a, x) => a + x.amount, 0);
      const names = [...new Set(expenses.map((x) => x.category))];
      return {
        title,
        summary: [["Total spent", formatMoney(totalSpent)], ["Expenses recorded", count(expenses.length)], ["Categories", count(names.length)]],
        sections: [
          { heading: "By category", columns: ["Category", "Entries", "Amount"], rows: names.map((n) => { const rows = expenses.filter((x) => x.category === n); return [n, count(rows.length), formatMoney(rows.reduce((a, x) => a + x.amount, 0))]; }), note: names.length ? undefined : "Nothing in this period." },
          listing("Expenses", ["Date", "Category", "Description", "Amount"], expenses.map((x) => [x.date, x.category, x.description || "—", formatMoney(x.amount)])),
        ],
      };
    }
    const rows = await Payroll.find({ date: r }).select("employee month base commission status").sort({ month: -1 }).limit(5000).lean();
    const people = await Employee.find({ _id: { $in: rows.map((x) => x.employee) } }).select("name").lean();
    const names = new Map(people.map((x) => [String(x._id), x.name]));
    const pay = (x: (typeof rows)[number]) => x.base + x.commission;
    const paidRows = rows.filter((x) => x.status === "Paid");
    return {
      title,
      summary: [["Paid", formatMoney(paidRows.reduce((a, x) => a + pay(x), 0))], ["Not paid yet", formatMoney(rows.filter((x) => x.status !== "Paid").reduce((a, x) => a + pay(x), 0))], ["Payroll entries", count(rows.length)]],
      sections: [listing("Payroll", ["Month", "Person", "Base", "Commission", "Total", "Status"], rows.map((x) => [x.month, names.get(String(x.employee)) ?? "—", formatMoney(x.base), formatMoney(x.commission), formatMoney(pay(x)), x.status]))],
    };
  }

  if (id === "hr") {
    const [people, departments, leaves] = await Promise.all([
      Employee.find({ status: "Active" }).select("department").lean(),
      Department.find().select("name").lean(),
      Leave.find({ date: r }).select("employee date type description").sort({ date: -1 }).limit(5000).lean(),
    ]);
    const staff = await Employee.find({ _id: { $in: leaves.map((l) => l.employee) } }).select("name").lean();
    const names = new Map(staff.map((x) => [String(x._id), x.name]));
    const deptName = new Map(departments.map((d) => [String(d._id), d.name]));
    return {
      title,
      summary: [["Active people", count(people.length)], ["Departments", count(departments.length)], ["Leave days taken", count(leaves.length)]],
      sections: [
        counted("People by department", "Department", tally(people, (x) => deptName.get(String(x.department)) ?? "Not set")),
        counted("Leave by type", "Type", tally(leaves, (l) => l.type)),
        listing("Leave", ["Date", "Person", "Type", "Reason"], leaves.map((l) => [l.date, names.get(String(l.employee)) ?? "—", l.type, l.description])),
      ],
    };
  }

  const [quotes, packages] = await Promise.all([
    Quotation.find({ date: r }).select("number client owner total date").sort({ date: -1 }).limit(5000).lean(),
    Package.find({ status: "active" }).select("name category price duration").sort({ name: 1 }).lean(),
  ]);
  return {
    title,
    summary: [["Quotations", count(quotes.length)], ["Total value", formatMoney(quotes.reduce((a, q) => a + q.total, 0))], ["Active packages", count(packages.length)]],
    sections: [
      counted("Quotations by salesperson", "Salesperson", tally(quotes, (q) => q.owner)),
      listing("Quotations", ["Date", "Number", "Client", "Salesperson", "Total"], quotes.map((q) => [q.date, q.number, q.client, q.owner, formatMoney(q.total)])),
      listing("Active packages", ["Package", "Category", "Duration", "Price"], packages.map((p) => [p.name, p.category, p.duration, formatMoney(p.price)])),
    ],
  };
}
