import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DialogButton } from "@/components/ui/dialog-button";
import { MILESTONE_STATUS, PROJECT_STATUS, TASK_STATUS, type Department, type ProjectType } from "@/lib/projects";

type Milestone = { _id: unknown; projectId: unknown; title: string; department: string; status: string; startDate?: string; dueDate?: string; assignees: string[] };
type Task = { _id: unknown; projectId: unknown; milestoneId: unknown; code: string; title: string; status: string; priority: string; assigneeCode: string; dueDate?: string; department: string };
type Props = {
  project: { _id: unknown; code: string; name: string; clientName: string; type: string; status: string; startDate?: string; dueDate?: string; description?: string };
  /** The parts of the project the signed-in person runs; the rest is not shown. */
  parts: Department[];
  /** Status of each part of a project with both parts (Super Admin only); empty hides it. */
  partsLine?: string;
  milestones: Milestone[];
  tasks: Task[];
  /** Shows this link-style text instead of the eye button (for example a project name). */
  trigger?: React.ReactNode;
};

/** A project's details, progress, milestones and tasks in a window, for the signed-in person's own part of the project. */
export function ProjectView({ project, parts, partsLine, milestones, tasks: allTasks, trigger }: Props) {
  const type = project.type as ProjectType;
  const mine = String(project._id);
  const shown = milestones.filter((m) => String(m.projectId) === mine && parts.includes(m.department as Department));
  const tasks = allTasks.filter((t) => String(t.projectId) === mine && parts.includes(t.department as Department));
  const done = tasks.filter((t) => t.status === "done").length;
  const progress = { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
  const stat = "rounded-xl border border-line bg-canvas px-3 py-2.5";
  const label = "text-[11px] font-semibold uppercase tracking-wide text-muted";
  return (
      <DialogButton label="View project" title={project.name} subtitle={`${project.code} · ${project.clientName} · ${type}`} icon={trigger ? undefined : <Eye className="h-4 w-4" />} trigger={trigger}>
        <div className="space-y-6 text-sm">
          <section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className={stat}><p className={label}>Status</p><p className="mt-1"><Badge tone={project.status === "completed" ? "success" : project.status === "on-hold" ? "warning" : "info"}>{PROJECT_STATUS[project.status as keyof typeof PROJECT_STATUS]}</Badge></p>{partsLine && <p className="mt-1 text-xs text-muted">{partsLine}</p>}</div>
              <div className={stat}><p className={label}>Start</p><p className="mt-1 font-semibold">{project.startDate || "—"}</p></div>
              <div className={stat}><p className={label}>Due</p><p className="mt-1 font-semibold">{project.dueDate || "—"}</p></div>
            </div>
            <div className="mt-3 rounded-xl border border-line px-4 py-3">
              <div className="mb-2 flex items-baseline justify-between"><p className={label}>Progress</p><p className="font-bold">{progress.percent}% <span className="font-normal text-muted">· {progress.done} of {progress.total} tasks done</span></p></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-brand-50" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Project progress">
                <div className="brand-gradient h-full rounded-full" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
            {project.description && <p className="mt-3 whitespace-pre-line rounded-xl bg-canvas px-4 py-3 text-muted">{project.description}</p>}
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 font-bold">Milestones <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{shown.length}</span></h3>
            {shown.length === 0 ? <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">No milestones yet.</p> : (
              <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
                {shown.map((m) => {
                  const mTasks = tasks.filter((t) => String(t.milestoneId) === String(m._id));
                  const doneCount = mTasks.filter((t) => t.status === "done").length;
                  return (
                    <li key={String(m._id)} className="relative">
                      <span className="absolute -left-[1.62rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" aria-hidden="true" />
                      <div className="overflow-hidden rounded-xl border border-brand-100 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2 bg-brand-50 px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-semibold">{m.title}</p>
                            <p className="mt-0.5 text-xs text-muted">{m.department === "marketing" ? "Marketing" : "Software"}{m.startDate ? ` · ${m.startDate}` : ""}{m.dueDate ? ` → ${m.dueDate}` : ""}</p>
                            {m.assignees.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{m.assignees.map((a) => <span key={a} className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium">{a}</span>)}</p>}
                          </div>
                          <div className="text-right">
                            <Badge tone={m.status === "done" ? "success" : m.status === "at-risk" ? "danger" : "info"}>{MILESTONE_STATUS[m.status as keyof typeof MILESTONE_STATUS]}</Badge>
                            <p className="mt-1 text-xs text-muted">{mTasks.length ? `${doneCount}/${mTasks.length} tasks done` : "No tasks"}</p>
                          </div>
                        </div>
                        {mTasks.length > 0 && (
                          <ul className="space-y-2 border-t border-brand-100 bg-white p-3">
                            {mTasks.map((t) => (
                              <li key={String(t._id)} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line border-l-4 px-3 py-2 ${t.status === "done" ? "border-l-success" : t.status === "completed" ? "border-l-warning" : t.status === "in-progress" ? "border-l-brand-500" : "border-l-line"}`}>
                                <div className="min-w-0">
                                  <p className="font-medium"><span className="mr-1.5 text-xs font-normal text-muted">{t.code}</span>{t.title}</p>
                                  <p className="text-xs text-muted">{t.assigneeCode || "Not assigned"}{t.dueDate ? ` · due ${t.dueDate}` : ""} · <span className="capitalize">{t.priority}</span></p>
                                </div>
                                <Badge tone={t.status === "done" ? "success" : t.status === "completed" ? "warning" : "info"}>{TASK_STATUS[t.status as keyof typeof TASK_STATUS]}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </DialogButton>
  );
}
