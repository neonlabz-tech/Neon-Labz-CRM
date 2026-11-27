import "server-only";
import { unstable_cache } from "next/cache";
import { addDays, todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { activeEmployees, marketingUsernames } from "@/lib/project-access";
import { companyGoals } from "@/lib/sales-targets";
import { Client } from "@/models/client";
import { Employee, Leave } from "@/models/hrms";
import { Task } from "@/models/task";
import { User } from "@/models/user";

export type Team = "software" | "marketing" | "sales";

/** Software and Marketing: how much of the period's work was finished (80%) and how much of it is not overdue (20%). */
export const FINISHED_WEIGHT = 0.8;
/** Points taken off the score for each day of non-approved leave. */
export const LEAVE_PENALTY = 2;
export const NON_APPROVED = "Non-approved Leave";
const OPEN = ["not-started", "in-progress"];

export type ScoreInput = { team: Team; assigned: number; overdue: number; completed: number; converted: number; nonApproved: number };

/**
 * One score out of 100 for everyone, so the teams can be ranked together. Nobody scores without work to measure:
 * Software and Marketing need a task assigned in the period, Sales needs a Monthly conversions target.
 */
export function scoreFor(r: ScoreInput, periodGoal: number): number | null {
  let score: number | null = null;
  if (r.team === "sales") {
    if (periodGoal > 0) score = Math.min(100, (r.converted / periodGoal) * 100);
  } else if (r.assigned >= 1) {
    const finished = Math.min(100, (r.completed / r.assigned) * 100);
    const onTime = (Math.max(0, r.assigned - r.overdue) / r.assigned) * 100;
    score = FINISHED_WEIGHT * finished + (1 - FINISHED_WEIGHT) * onTime;
  }
  return score === null ? null : Math.max(0, Math.round(score - LEAVE_PENALTY * r.nonApproved));
}

type Counts = ScoreInput & { username: string; name: string; leave: number; left: number };
export type Standing = Counts & { score: number | null; rank: number | null };

/** Best score first; then more finished or converted, then fewer days of leave, then name. */
const order = (a: Counts & { score: number | null }, b: Counts & { score: number | null }) =>
  (b.score as number) - (a.score as number) || b.completed + b.converted - (a.completed + a.converted) || a.leave - b.leave || a.name.localeCompare(b.name);

/** Everyone's counts and score for the dates from..to, ranked across the whole company. */
export async function loadStandings(from: string, to: string): Promise<Standing[]> {
  const today = todayISO();
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(`${to}T23:59:59.999+05:30`);
  const inRange = (d: Date | null | undefined) => Boolean(d) && (d as Date) >= start && (d as Date) <= end;
  const span = Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000) + 1;

  await connectDb();
  const [staff, marketing, salesUsers, goals] = await Promise.all([
    activeEmployees(),
    marketingUsernames(),
    User.find({ role: "sales", active: true }).select("username fullName role").sort({ username: 1 }).lean(),
    companyGoals(),
  ]);
  const people = [...staff, ...salesUsers].map((p) => ({
    username: p.username,
    name: p.fullName || p.username,
    team: (p.role === "sales" ? "sales" : marketing.has(p.username) ? "marketing" : "software") as Team,
  }));
  const taskPeople = people.filter((p) => p.team !== "sales").map((p) => p.username);
  const salesPeople = people.filter((p) => p.team === "sales").map((p) => p.username);

  const [tasks, converted, profiles, leftRows] = await Promise.all([
    taskPeople.length ? Task.find({
      assigneeCode: { $in: taskPeople },
      $or: [{ createdAt: { $gte: start, $lte: end } }, { completedAt: { $gte: start, $lte: end } }, { doneAt: { $gte: start, $lte: end } }],
    }).select("assigneeCode status dueDate createdAt completedAt doneAt").lean() : [],
    salesPeople.length ? Client.find({ salesOwner: { $in: salesPeople }, createdAt: { $gte: start, $lte: end } }).select("salesOwner").lean() : [],
    Employee.find({ username: { $in: people.map((p) => p.username) } }).select("username").lean(),
    // Tasks still to do or in progress, whenever they were given (a task sent for review is not counted).
    taskPeople.length ? Task.aggregate<{ _id: string; n: number }>([{ $match: { assigneeCode: { $in: taskPeople }, status: { $in: OPEN } } }, { $group: { _id: "$assigneeCode", n: { $sum: 1 } } }]) : [],
  ]);
  const usernameOf = new Map(profiles.map((e) => [String(e._id), e.username]));
  const leaves = profiles.length ? await Leave.find({ employee: { $in: profiles.map((e) => e._id) }, date: { $gte: from, $lte: to } }).select("employee type").lean() : [];

  const rows = new Map<string, Counts>(people.map((p) => [p.username, { username: p.username, name: p.name, team: p.team, assigned: 0, overdue: 0, completed: 0, converted: 0, leave: 0, nonApproved: 0, left: 0 }]));
  for (const t of tasks) {
    const row = rows.get(t.assigneeCode);
    if (!row) continue;
    const finished = t.status === "completed" || t.status === "waiting" || t.status === "done";
    const late = OPEN.includes(t.status) && Boolean(t.dueDate) && t.dueDate < today;
    const assignedNow = inRange((t as { createdAt?: Date }).createdAt);
    const doneNow = finished && inRange(t.completedAt ?? t.doneAt);
    if (!(assignedNow || doneNow)) continue;
    if (assignedNow) row.assigned += 1;
    if (doneNow) row.completed += 1;
    if (late) row.overdue += 1;
  }
  for (const l of leftRows) {
    const row = rows.get(l._id);
    if (row) row.left = l.n;
  }
  for (const c of converted) {
    const row = rows.get(c.salesOwner);
    if (row) row.converted += 1;
  }
  for (const l of leaves) {
    const row = rows.get(usernameOf.get(String(l.employee)) ?? "");
    if (!row) continue;
    row.leave += 1;
    if (l.type === NON_APPROVED) row.nonApproved += 1;
  }

  const periodGoal = (goals.monthlyConversions * span) / 30;
  const scored = [...rows.values()].map((r) => ({ ...r, score: scoreFor(r, periodGoal) }));
  const ranked = scored.filter((r) => r.score !== null).sort(order).map((r, i) => ({ ...r, rank: i + 1 as number | null }));
  const unranked = scored.filter((r) => r.score === null).sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ ...r, rank: null as number | null }));
  return [...ranked, ...unranked];
}

export const STANDINGS_DAYS = 30;

/**
 * The last 30 days' score and place of everyone who has a score. Worked out once and shared by every page for 15 minutes,
 * so showing each person their own place never adds database work to the page they are on.
 */
export const companyStandings = unstable_cache(
  async () => {
    const today = todayISO();
    const rows = await loadStandings(addDays(today, -(STANDINGS_DAYS - 1)), today);
    return rows.filter((r) => r.score !== null).map((r) => ({ username: r.username, score: r.score as number, rank: r.rank as number, team: r.team, assigned: r.assigned, completed: r.completed, overdue: r.overdue, converted: r.converted, leave: r.leave, nonApproved: r.nonApproved, left: r.left }));
  },
  // Change the version when what is counted changes, so a saved result of the old count is not reused.
  ["company-standings-30d-v2"],
  { revalidate: 15 * 60 }
);
