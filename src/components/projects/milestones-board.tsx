import { Pencil } from "lucide-react";
import { MilestoneDelete } from "@/components/projects/milestone-delete";
import { MilestoneForm } from "@/components/projects/milestone-form";
import { TaskCard } from "@/components/projects/task-card";
import { TaskColumn } from "@/components/projects/task-column";
import { TaskForm, type TaskView } from "@/components/projects/task-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DialogButton } from "@/components/ui/dialog-button";
import { InlineForms } from "@/components/ui/dialog-shell";
import { richToHtml } from "@/lib/rich-text";
import type { Role } from "@/lib/permissions";
import { canManageDepartment, MILESTONE_STATUS, TASK_STATUS, type Department, type ProjectType } from "@/lib/projects";

type Person = { username: string; label: string };
export type BoardMilestone = { _id: unknown; title: string; department: string; status: string; startDate?: string; dueDate?: string; assignees: string[] };
export type BoardTask = { _id: unknown; milestoneId: unknown; code: string; title: string; priority: string; assigneeCode: string; startDate?: string; dueDate?: string; description?: string; status: string };

type Props = {
  projectCode: string; type: ProjectType; role: Role; username: string;
  milestones: BoardMilestone[]; tasks: BoardTask[]; lanes: Department[];
  software: Person[]; marketing: Person[]; mixed: Person[];
};

/** The Milestones part of a project: the task board of each milestone, with edit and delete next to each milestone and task. */
export function MilestonesBoard({ projectCode, type, role, username, milestones, tasks, lanes, software, marketing, mixed }: Props) {
  const isEmployee = role === "employee";
  const poolFor = (department: Department) => (department === "marketing" ? marketing : software);

  return (
    <>
      <h2 className="mb-3 text-lg font-bold">Milestones</h2>
      <div className="space-y-5">
        {milestones.length === 0 && <Card><p className="text-sm text-muted">{isEmployee ? "No milestones are assigned to you on this project." : "No milestones yet. Add the first one below."}</p></Card>}
        {milestones.map((m) => {
          const id = String(m._id);
          const manager = !isEmployee && canManageDepartment(role, type, m.department as Department);
          const rows = tasks.filter((t) => String(t.milestoneId) === id);
          const finished = m.status === "done";
          const canAdd = manager || (isEmployee && !finished);
          const views: (TaskView & { _id: string })[] = rows.map((t) => ({
            _id: String(t._id), id: String(t._id), code: t.code, title: t.title, priority: t.priority, assigneeCode: t.assigneeCode,
            startDate: t.startDate ?? "", dueDate: t.dueDate ?? "", description: richToHtml(t.description ?? ""), status: t.status,
          }));
          return (
            <Card key={id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{m.title}</h3>
                  <p className="text-xs text-muted">{m.department === "marketing" ? "Marketing" : "Software"}{m.startDate ? ` · ${m.startDate}` : ""}{m.dueDate ? ` → ${m.dueDate}` : ""}{m.assignees.length ? ` · ${m.assignees.join(", ")}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={finished ? "success" : m.status === "at-risk" ? "danger" : "info"}>{MILESTONE_STATUS[m.status as keyof typeof MILESTONE_STATUS]}</Badge>
                  {manager && (
                    <DialogButton label="Edit milestone" title="Edit milestone" subtitle={`${projectCode} · ${m.title}`} icon={<Pencil className="h-4 w-4" />}>
                      <MilestoneForm projectCode={projectCode} type={type} allowed={lanes} employees={poolFor(m.department as Department)} milestone={{ id, title: m.title, startDate: m.startDate ?? "", dueDate: m.dueDate ?? "", department: m.department as Department, assignees: m.assignees }} />
                    </DialogButton>
                  )}
                  {manager && <MilestoneDelete code={projectCode} id={id} title={m.title} />}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(TASK_STATUS) as (keyof typeof TASK_STATUS)[]).map((status) => (
                  <TaskColumn key={status} projectCode={projectCode} status={status} title={TASK_STATUS[status]} count={views.filter((t) => t.status === status).length} accepts={!finished && (manager || (isEmployee && status !== "done"))}>
                    {views.filter((t) => t.status === status).map((t) => (
                      <TaskCard key={t._id} projectCode={projectCode} milestoneId={id} task={t} manager={manager} mine={t.assigneeCode === username} locked={finished} employees={poolFor(m.department as Department)} />
                    ))}
                  </TaskColumn>
                ))}
              </div>

              {canAdd && (
                <InlineForms>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-brand-700">Add a task</summary>
                    <div className="mt-3"><TaskForm projectCode={projectCode} milestoneId={id} employees={poolFor(m.department as Department)} manager={manager} /></div>
                  </details>
                </InlineForms>
              )}
            </Card>
          );
        })}

        {lanes.length > 0 && !isEmployee && (
          <Card>
            <h3 className="mb-3 font-semibold">Add a milestone</h3>
            <InlineForms><MilestoneForm projectCode={projectCode} type={type} allowed={lanes} employees={lanes.length > 1 ? mixed : poolFor(lanes[0] ?? "software")} /></InlineForms>
          </Card>
        )}
      </div>
    </>
  );
}
