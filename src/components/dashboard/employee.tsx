import { PeriodFilter } from "@/components/finance/period-filter";
import { connectDb } from "@/lib/db";
import { dateIn, periodNote, timeIn } from "@/lib/dashboard";
import { addDays, todayISO } from "@/lib/dates";
import { MONTHS, readPeriod } from "@/lib/finance";
import type { SearchParams } from "@/lib/pagination";
import { TASK_STATUS } from "@/lib/projects";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { Badge } from "@/components/ui/badge";
import { Bars, ChartGrid, Gauge, Hero, Kpis, MiniRing, Panel, PALETTE } from "./widgets";

const finished = (status: string) => status === "completed" || status === "done";
const stamp = (task: { completedAt?: Date | null; doneAt?: Date | null }) => task.completedAt ?? task.doneAt ?? null;

export async function EmployeeDashboard({ username, name, sp }: { username: string; name: string; sp: SearchParams }) {
  const today = todayISO();
  const { year, month, prefix } = readPeriod(sp, today);
  await connectDb();
  const time = timeIn(prefix);
  const tasks = await Task.find({ assigneeCode: username, ...(prefix ? { $or: [...(dateIn(prefix, "startDate", "dueDate").$or as object[]), { completedAt: time }, { doneAt: time }] } : {}) })
    .select("title projectId status dueDate completedAt doneAt").limit(500).lean();
  const projects = await Project.find({ _id: { $in: [...new Set(tasks.map((t) => String(t.projectId)))] } }).select("name owner").lean();
  const projectName = new Map(projects.map((p) => [String(p._id), p.name]));

  const done = tasks.filter((t) => finished(t.status));
  const percent = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const open = tasks.filter((t) => !finished(t.status));
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const soon = open.filter((t) => t.dueDate >= today && t.dueDate <= addDays(today, 3)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const count = (status: string) => tasks.filter((t) => t.status === status).length;

  // Finished tasks per day for one month, or per month for a whole year.
  const buckets = new Map<string, number>();
  for (const task of done) {
    const at = stamp(task);
    if (!at) continue;
    const key = at.toISOString().slice(month ? 8 : 5, month ? 10 : 7);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const chart = [...buckets.entries()].sort().map(([key, value], index) => ({ id: key, label: month ? `Day ${Number(key)}` : MONTHS[Number(key) - 1] ?? key, value, color: PALETTE[index % PALETTE.length]! }));

  const list = (rows: typeof tasks, tag: string, tone: "danger" | "brand") => rows.map((task) => (
    <li key={String(task._id)} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <span><strong>{task.title}</strong><span className="block text-muted">{projectName.get(String(task.projectId)) ?? "Project"} · {task.dueDate}</span></span>
      <Badge tone={tone}>{tag}</Badge>
    </li>
  ));

  return (
    <>
      <PeriodFilter year={year} month={month} basePath="/dashboard" />
      <Hero kicker={name} title="My dashboard" note={`Your tasks and projects for ${periodNote(year, month, MONTHS)}`} badge={`${percent}% finished`} />
      <Kpis items={[
        { label: "Projects", value: projects.length },
        { label: "Assigned tasks", value: tasks.length },
        { label: TASK_STATUS["not-started"], value: count("not-started") },
        { label: TASK_STATUS["in-progress"], value: count("in-progress") },
        { label: "Finished", value: done.length },
        { label: "Overdue", value: overdue.length },
      ]} />
      <Panel title="Overall task completion"><Gauge value={percent} label={`${done.length} of ${tasks.length} tasks finished`} /></Panel>
      <ChartGrid>
        <Bars title="Tasks you finished" data={chart} empty="Nothing finished in this period yet." />
        <Panel title="My projects" empty={projects.length ? undefined : "No milestone has been assigned to you yet."}>
          {projects.length > 0 && projects.map((project) => {
            const mine = tasks.filter((t) => String(t.projectId) === String(project._id));
            const share = mine.length ? Math.round((mine.filter((t) => finished(t.status)).length / mine.length) * 100) : 0;
            return <div key={String(project._id)} className="mb-3 flex items-center gap-3 text-sm"><MiniRing value={share} /><span className="min-w-0 flex-1"><strong className="block truncate">{project.name}</strong><span className="text-muted">{mine.filter((t) => finished(t.status)).length} of {mine.length} tasks</span></span></div>;
          })}
        </Panel>
      </ChartGrid>
      <ChartGrid>
        <Panel title="Due in the next 3 days" empty={soon.length ? undefined : "Nothing due in the next 3 days."}>{soon.length > 0 && <ul className="divide-y divide-line">{list(soon, "Soon", "brand")}</ul>}</Panel>
        <Panel title="Overdue" empty={overdue.length ? undefined : "No overdue tasks."}>{overdue.length > 0 && <ul className="divide-y divide-line">{list(overdue, "Overdue", "danger")}</ul>}</Panel>
      </ChartGrid>
    </>
  );
}
