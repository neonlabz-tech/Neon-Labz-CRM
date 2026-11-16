import Link from "next/link";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui/card";
import { SearchBar } from "@/components/ui/list-controls";
import { Badge } from "@/components/ui/badge";
import { requireAction } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { visibleProjectFilter } from "@/lib/project-access";
import { escapeRegex, param, type SearchParams } from "@/lib/pagination";
import { PRIORITY, TASK_STATUS } from "@/lib/projects";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { CheckCircle2, Clock, ListTodo } from "lucide-react";

export const metadata = { title: "My work" };

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("tasks.work");
  const sp = await searchParams;
  const q = param(sp, "q");
  const projectFilter = param(sp, "project");
  const statusFilter = param(sp, "status");
  const priorityFilter = param(sp, "priority");
  await connectDb();
  const [projects, tasks, totals] = await Promise.all([
    Project.find(await visibleProjectFilter(user)).select("code name clientName dueDate").sort({ createdAt: -1 }).limit(50).lean(),
    Task.find({
      assigneeCode: user.username,
      ...(q && { title: { $regex: escapeRegex(q), $options: "i" } }),
      ...(statusFilter in TASK_STATUS && { status: statusFilter }),
      ...(priorityFilter in PRIORITY && { priority: priorityFilter }),
    }).select("code title status dueDate priority projectId").sort({ createdAt: -1 }).limit(200).lean(),
    Task.aggregate<{ _id: string; n: number }>([{ $match: { assigneeCode: user.username } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const shown = projectFilter ? tasks.filter((t) => String(t.projectId) === projectFilter) : tasks;
  const count = (status: string) => totals.find((t) => t._id === status)?.n ?? 0;
  const today = todayISO();
  const byProject = new Map(projects.map((p) => [String(p._id), p]));

  return (
    <>
      <PageHeader title="My work" subtitle="Your projects and tasks. Open a project to add tasks and move them along." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="To Do" value={count("not-started")} icon={<ListTodo className="h-5 w-5" />} />
        <Stat label="In Progress" value={count("in-progress")} icon={<Clock className="h-5 w-5" />} />
        <Stat label="Completed or Done" value={count("completed") + count("done")} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <h2 className="mb-3 text-lg font-bold">My projects</h2>
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" text="Your project manager will add you to a project." />
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link prefetch={false} key={p.code} href={`/projects/${p.code}`} className="rounded-2xl border border-line bg-white p-5 hover:border-brand-300">
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-muted">{p.code} · {p.clientName}</p>
              {p.dueDate && <p className="mt-2 text-xs text-muted">Due {p.dueDate}</p>}
            </Link>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-bold">My tasks</h2>
      <SearchBar q={q} placeholder="Search by title…" filters={[
        { name: "project", label: "All projects", value: projectFilter, options: projects.map((p) => ({ value: String(p._id), label: p.name })) },
        { name: "status", label: "All statuses", value: statusFilter, options: Object.entries(TASK_STATUS).map(([value, label]) => ({ value, label })) },
        { name: "priority", label: "All priorities", value: priorityFilter, options: Object.entries(PRIORITY).map(([value, label]) => ({ value, label })) },
      ]} />
      {shown.length === 0 ? <Card><p className="text-sm text-muted">No tasks match these filters.</p></Card> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {shown.map((t) => {
            const project = byProject.get(String(t.projectId));
            const late = t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "done";
            return (
              <li key={t.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-xs text-muted">{t.code}{project ? ` · ${project.name}` : ""}{t.dueDate ? ` · due ${t.dueDate}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {late && <Badge tone="danger">Late</Badge>}
                  <Badge tone={t.status === "done" ? "success" : t.status === "in-progress" ? "info" : "brand"}>{TASK_STATUS[t.status as keyof typeof TASK_STATUS]}</Badge>
                  {project && <Link prefetch={false} href={`/projects/${project.code}`} className="font-semibold text-brand-700 hover:underline">Open</Link>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
