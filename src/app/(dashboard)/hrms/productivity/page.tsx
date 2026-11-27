import Link from "next/link";
import { CalendarOff, CheckCircle2, Gauge, UserCheck } from "lucide-react";
import { EmptyState, Stat } from "@/components/ui/card";
import { RankTable, type RankItem, type RankRow } from "@/components/hrms/rank-table";
import { ScoreChart, type ChartTeam } from "@/components/hrms/score-chart";
import { addDays, ISO_DATE, todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { param, type SearchParams } from "@/lib/pagination";
import { activeEmployees, marketingUsernames } from "@/lib/project-access";
import { TASK_STATUS } from "@/lib/projects";
import { companyGoals } from "@/lib/sales-targets";
import { cn } from "@/lib/utils";
import { Client } from "@/models/client";
import { Employee, Leave } from "@/models/hrms";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { User } from "@/models/user";

export const metadata = { title: "HR · Productivity" };

const TEAMS = [["all", "Everyone"], ["software", "Software"], ["marketing", "Marketing"], ["sales", "Sales"]] as const;
const RANGES = [["week", "Last 7 days", 7], ["month", "Last 30 days", 30], ["year", "Last 12 months", 365]] as const;
const OPEN = ["not-started", "in-progress"];
/** Software and Marketing: how much of the period's work was finished (80%) and how much of it is not overdue (20%). */
const FINISHED_WEIGHT = 0.8;
/** Points taken off the score for each day of non-approved leave. */
const LEAVE_PENALTY = 2;
const NON_APPROVED = "Non-approved Leave";
const tone = (status: string): RankItem["tone"] => (status === "done" ? "success" : status === "completed" ? "info" : status === "in-progress" ? "warning" : "brand");

type Row = { username: string; name: string; team: ChartTeam; assigned: number; overdue: number; completed: number; converted: number; leave: number; nonApproved: number };

export default async function HrmsProductivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const today = todayISO();
  const asked = param(sp, "range");
  const teamAsked = param(sp, "team");
  const team = TEAMS.some(([id]) => id === teamAsked) ? teamAsked : "all";
  const range = asked === "custom" || RANGES.some(([id]) => id === asked) ? asked : "week";

  // The period: a rolling window ending today, or the two dates typed for a custom range.
  let from = addDays(today, -6);
  let to = today;
  if (range === "custom") {
    const f = param(sp, "from");
    const t = param(sp, "to");
    from = ISO_DATE.test(f) ? f : addDays(today, -29);
    to = ISO_DATE.test(t) ? t : today;
    if (from > to) [from, to] = [to, from];
  } else {
    const days = RANGES.find(([id]) => id === range)?.[2] ?? 7;
    from = addDays(today, -(days - 1));
  }
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
  const teamOf = (p: { username: string; role: string }): ChartTeam => (p.role === "sales" ? "sales" : marketing.has(p.username) ? "marketing" : "software");
  const everyone = [...staff, ...salesUsers].map((p) => ({ username: p.username, name: p.fullName || p.username, team: teamOf(p) }));
  const people = team === "all" ? everyone : everyone.filter((p) => p.team === team);
  const taskPeople = people.filter((p) => p.team !== "sales").map((p) => p.username);
  const salesPeople = people.filter((p) => p.team === "sales").map((p) => p.username);

  // The period's work: tasks given in it or finished in it.
  const tasks = taskPeople.length ? await Task.find({
    assigneeCode: { $in: taskPeople },
    $or: [
      { createdAt: { $gte: start, $lte: end } },
      { completedAt: { $gte: start, $lte: end } },
      { doneAt: { $gte: start, $lte: end } },
    ],
  }).select("code title projectId assigneeCode status dueDate createdAt completedAt doneAt").sort({ dueDate: 1 }).lean() : [];
  const projects = await Project.find({ _id: { $in: [...new Set(tasks.map((t) => String(t.projectId)))] } }).select("name code").lean();
  const projectOf = new Map(projects.map((p) => [String(p._id), p]));
  // Sales: clients a salesperson converted in the period (a client is created when a lead converts).
  const converted = salesPeople.length ? await Client.find({ salesOwner: { $in: salesPeople }, createdAt: { $gte: start, $lte: end } }).select("code name salesOwner").sort({ createdAt: -1 }).lean() : [];
  // Leave taken in the period, from the leave records of each person's employee profile.
  const profiles = await Employee.find({ username: { $in: people.map((p) => p.username) } }).select("username").lean();
  const usernameOf = new Map(profiles.map((e) => [String(e._id), e.username]));
  const leaves = profiles.length ? await Leave.find({ employee: { $in: profiles.map((e) => e._id) }, date: { $gte: from, $lte: to } }).select("employee type").lean() : [];

  const rows = new Map<string, Row>(people.map((p) => [p.username, { username: p.username, name: p.name, team: p.team, assigned: 0, overdue: 0, completed: 0, converted: 0, leave: 0, nonApproved: 0 }]));
  const lists = new Map<string, RankItem[]>();
  for (const t of tasks) {
    const row = rows.get(t.assigneeCode);
    if (!row) continue;
    const finishedAt = t.completedAt ?? t.doneAt;
    const finished = t.status === "completed" || t.status === "done";
    const open = OPEN.includes(t.status);
    const late = open && Boolean(t.dueDate) && t.dueDate < today;
    const assignedNow = inRange((t as { createdAt?: Date }).createdAt);
    const doneNow = finished && inRange(finishedAt);
    // Only the period's own work counts: tasks given in it or finished in it. Their status shown is today's.
    if (!(assignedNow || doneNow)) continue;
    if (assignedNow) row.assigned += 1;
    if (doneNow) row.completed += 1;
    if (late) row.overdue += 1;
    const project = projectOf.get(String(t.projectId));
    const list = lists.get(t.assigneeCode) ?? [];
    list.push({ code: t.code, title: t.title, project: project?.name ?? "", projectCode: project?.code ?? "", status: t.status, statusLabel: TASK_STATUS[t.status as keyof typeof TASK_STATUS] ?? t.status, tone: tone(t.status), dueDate: t.dueDate, late });
    lists.set(t.assigneeCode, list);
  }
  for (const c of converted) {
    const row = rows.get(c.salesOwner);
    if (!row) continue;
    row.converted += 1;
    const list = lists.get(c.salesOwner) ?? [];
    list.push({ code: c.code, title: c.name, project: "", projectCode: "", status: "converted", statusLabel: "Converted", tone: "success", dueDate: "", late: false });
    lists.set(c.salesOwner, list);
  }
  for (const l of leaves) {
    const row = rows.get(usernameOf.get(String(l.employee)) ?? "");
    if (!row) continue;
    row.leave += 1;
    if (l.type === NON_APPROVED) row.nonApproved += 1;
  }

  // Score out of 100 for everyone, so the teams can be ranked together. Nobody scores without work to measure.
  const monthlyGoal = goals.monthlyConversions;
  const periodGoal = (monthlyGoal * span) / 30;
  const scoreOf = (r: Row): number | null => {
    let score: number | null = null;
    if (r.team === "sales") {
      if (periodGoal > 0) score = Math.min(100, (r.converted / periodGoal) * 100);
    } else if (r.assigned >= 1) {
      const finished = Math.min(100, (r.completed / r.assigned) * 100);
      const onTime = (Math.max(0, r.assigned - r.overdue) / r.assigned) * 100;
      score = FINISHED_WEIGHT * finished + (1 - FINISHED_WEIGHT) * onTime;
    }
    return score === null ? null : Math.max(0, Math.round(score - LEAVE_PENALTY * r.nonApproved));
  };
  const scored = [...rows.values()].map((r) => ({ ...r, score: scoreOf(r) }));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  // Best score first; then more finished or converted, then fewer days of leave, then name.
  const ranked = scored.filter((r) => r.score !== null).sort((a, b) => (b.score as number) - (a.score as number) || b.completed + b.converted - (a.completed + a.converted) || a.leave - b.leave || byName(a, b));
  const unranked = scored.filter((r) => r.score === null).sort(byName);
  const table: RankRow[] = [...ranked.map((r, i) => ({ ...r, rank: i + 1 as number | null })), ...unranked.map((r) => ({ ...r, rank: null as number | null }))].map((r) => ({ ...r, items: lists.get(r.username) ?? [] }));

  const inView: ChartTeam[] = team === "all" ? ["software", "marketing", "sales"] : [team as ChartTeam];
  const averages = inView.map((t) => {
    const scores = ranked.filter((r) => r.team === t).map((r) => r.score as number);
    return { team: t, value: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
  }).filter((a) => people.some((p) => p.team === a.team));
  const link = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ range, team, ...(range === "custom" ? { from, to } : {}), ...patch });
    return `?${q.toString()}`;
  };
  const sum = (key: "completed" | "converted" | "leave") => scored.reduce((n, r) => n + r[key], 0);
  const label = range === "custom" ? `${from} to ${to}` : RANGES.find(([id]) => id === range)?.[1] ?? "";
  const noSalesTarget = people.some((p) => p.team === "sales") && monthlyGoal <= 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-brand-50 p-1">
          {RANGES.map(([id, text]) => (
            <Link prefetch={false} key={id} href={link({ range: id })} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", range === id ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>{text}</Link>
          ))}
          <Link prefetch={false} href={link({ range: "custom" })} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", range === "custom" ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>Custom</Link>
        </div>
        {range === "custom" && <form className="flex flex-wrap items-end gap-2 text-sm" method="get">
          <input type="hidden" name="range" value="custom" />
          <input type="hidden" name="team" value={team} />
          <label className="grid gap-1 text-xs font-medium text-muted">From<input type="date" name="from" defaultValue={from} max={today} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink" /></label>
          <label className="grid gap-1 text-xs font-medium text-muted">To<input type="date" name="to" defaultValue={to} max={today} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink" /></label>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Apply</button>
        </form>}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-brand-50 p-1 sm:w-fit">
        {TEAMS.map(([id, text]) => (
          <Link prefetch={false} key={id} href={link({ team: id })} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold", team === id ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>{text}</Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Average score" value={ranked.length ? Math.round(ranked.reduce((n, r) => n + (r.score as number), 0) / ranked.length) : "–"} hint={label} icon={<Gauge className="h-5 w-5" />} />
        <Stat label="Tasks finished" value={sum("completed")} hint={label} icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat label="Clients converted" value={sum("converted")} hint={label} icon={<UserCheck className="h-5 w-5" />} />
        <Stat label="Leave days" value={sum("leave")} hint={label} icon={<CalendarOff className="h-5 w-5" />} />
      </div>

      {noSalesTarget && (
        <p className="mb-4 rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">Sales is not ranked yet. Set the <Link prefetch={false} href="/sales-settings" className="font-semibold text-brand-700 hover:underline">Monthly conversions target</Link> in Sales settings.</p>
      )}

      {people.length === 0 ? <EmptyState title="No employees yet" text="Add employees to see their productivity here." /> : (
        <>
          <ScoreChart averages={averages} people={ranked.map((r) => ({ name: r.name, team: r.team, score: r.score as number }))} />
          <RankTable rows={table} />
          <p className="mt-3 text-xs text-muted">Score is out of 100. Software and Marketing: 80% of the period&apos;s assigned tasks finished plus 20% not overdue. Sales: clients converted ÷ the Monthly conversions target for the period (monthly target × days ÷ 30), up to 100. Each day of non-approved leave takes 2 points off. Ties go to more finished or converted, then fewer leave days. Anyone with no task assigned in the period (Sales: no target set) is not ranked.</p>
        </>
      )}
    </>
  );
}
