import Link from "next/link";
import { AlertTriangle, CheckCircle2, ListChecks, Loader } from "lucide-react";
import { EmptyState, Stat } from "@/components/ui/card";
import { RankTable, type RankItem } from "@/components/hrms/rank-table";
import { addDays, ISO_DATE, todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { param, type SearchParams } from "@/lib/pagination";
import { activeEmployees, marketingUsernames } from "@/lib/project-access";
import { TASK_STATUS } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { Project } from "@/models/project";
import { Task } from "@/models/task";

export const metadata = { title: "HR · Productivity" };

const TEAMS = [["all", "Everyone"], ["software", "Software"], ["marketing", "Marketing"]] as const;
const RANGES = [["week", "Last 7 days", 7], ["month", "Last 30 days", 30], ["year", "Last 12 months", 365]] as const;
const OPEN = ["not-started", "in-progress"];
const tone = (status: string): RankItem["tone"] => (status === "done" ? "success" : status === "completed" ? "info" : status === "in-progress" ? "warning" : "brand");

type Row = { username: string; name: string; role: string; assigned: number; doing: number; review: number; overdue: number; completed: number };

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

  await connectDb();
  const everyone = await activeEmployees();
  const marketing = team === "all" ? new Set<string>() : await marketingUsernames();
  const people = team === "all" ? everyone : everyone.filter((p) => marketing.has(p.username) === (team === "marketing"));
  const usernames = people.map((p) => p.username);
  // The period's work: tasks given in it or finished in it.
  const tasks = await Task.find({
    assigneeCode: { $in: usernames },
    $or: [
      { createdAt: { $gte: start, $lte: end } },
      { completedAt: { $gte: start, $lte: end } },
      { doneAt: { $gte: start, $lte: end } },
    ],
  }).select("code title projectId assigneeCode status dueDate createdAt completedAt doneAt").sort({ dueDate: 1 }).lean();
  const projects = await Project.find({ _id: { $in: [...new Set(tasks.map((t) => String(t.projectId)))] } }).select("name code").lean();
  const projectOf = new Map(projects.map((p) => [String(p._id), p]));

  const rows = new Map<string, Row>(people.map((p) => [p.username, { username: p.username, name: p.fullName || p.username, role: p.role, assigned: 0, doing: 0, review: 0, overdue: 0, completed: 0 }]));
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
    if (t.status === "in-progress") row.doing += 1;
    if (t.status === "completed") row.review += 1;
    if (late) row.overdue += 1;
    const project = projectOf.get(String(t.projectId));
    const list = lists.get(t.assigneeCode) ?? [];
    list.push({ code: t.code, title: t.title, project: project?.name ?? "", projectCode: project?.code ?? "", status: t.status, statusLabel: TASK_STATUS[t.status as keyof typeof TASK_STATUS] ?? t.status, tone: tone(t.status), dueDate: t.dueDate, late });
    lists.set(t.assigneeCode, list);
  }

  const all = [...rows.values()].sort((a, b) => a.username.localeCompare(b.username));
  // Rank by the share of the period's assigned tasks that were finished (capped at 100%), so 4 of 4 and 10 of 10 tie.
  const scored = all.map((r) => ({ ...r, percent: r.assigned ? Math.min(100, Math.round((r.completed / r.assigned) * 100)) : 0 }));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  // Anyone with at least one task assigned in the period is ranked; the rest follow without a place.
  const first = scored.filter((r) => r.assigned >= 1).sort((a, b) => b.percent - a.percent || b.completed - a.completed || a.overdue - b.overdue || byName(a, b));
  const rest = scored.filter((r) => r.assigned < 1).sort((a, b) => b.completed - a.completed || byName(a, b));
  const ranked = [...first.map((r, i) => ({ ...r, rank: i + 1 as number | null })), ...rest.map((r) => ({ ...r, rank: null as number | null }))];
  const link = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ range, team, ...(range === "custom" ? { from, to } : {}), ...patch });
    return `?${q.toString()}`;
  };
  const sum = (key: keyof Pick<Row, "assigned" | "doing" | "review" | "overdue" | "completed">) => all.reduce((n, r) => n + r[key], 0);
  const label = range === "custom" ? `${from} to ${to}` : RANGES.find(([id]) => id === range)?.[1] ?? "";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-brand-50 p-1">
          {RANGES.map(([id, text]) => (
            <Link prefetch={false} key={id} href={link({ range: id })} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", range === id ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>{text}</Link>
          ))}
          <span className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", range === "custom" ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>Custom</span>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm" method="get">
          <input type="hidden" name="range" value="custom" />
          <input type="hidden" name="team" value={team} />
          <label className="grid gap-1 text-xs font-medium text-muted">From<input type="date" name="from" defaultValue={from} max={today} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink" /></label>
          <label className="grid gap-1 text-xs font-medium text-muted">To<input type="date" name="to" defaultValue={to} max={today} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink" /></label>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Apply</button>
        </form>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-brand-50 p-1 sm:w-fit">
        {TEAMS.map(([id, text]) => (
          <Link prefetch={false} key={id} href={link({ team: id })} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", team === id ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>{text}</Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Assigned" value={sum("assigned")} hint={label} icon={<ListChecks className="h-5 w-5" />} />
        <Stat label="In progress" value={sum("doing")} icon={<Loader className="h-5 w-5" />} />
        <Stat label="Overdue" value={sum("overdue")} icon={<AlertTriangle className="h-5 w-5" />} />
        <Stat label="Completed" value={sum("completed")} hint={label} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {all.length === 0 ? <EmptyState title="No employees yet" text="Add employees to see their productivity here." /> : (
        <>
          <RankTable rows={ranked.map((r) => ({ ...r, items: lists.get(r.username) ?? [] }))} />
          <p className="mt-3 text-xs text-muted">Ranked by Completion (completed ÷ assigned in the period, up to 100%), then by Completed, then fewer Overdue. People with no task assigned in the period are not ranked. Assigned and Completed count the chosen period. In progress, In review and Overdue are the status today of those same tasks.</p>
        </>
      )}
    </>
  );
}
