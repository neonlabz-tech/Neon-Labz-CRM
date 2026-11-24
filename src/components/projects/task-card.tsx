"use client";

import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm";
import { DialogButton } from "@/components/ui/dialog-button";
import { useToast } from "@/components/ui/toast";
import { PRIORITY, TASK_STATUS, type TaskStatus } from "@/lib/projects";
import { deleteTaskAction, moveTaskAction } from "@/server/task-actions";
import { TaskForm, type TaskView } from "./task-form";

type Props = {
  projectCode: string; milestoneId: string; task: TaskView; manager: boolean; mine: boolean; locked: boolean;
  employees: { username: string; label: string }[]; minDate?: string; maxDate?: string;
};

const tone = { critical: "danger", high: "warning", medium: "info", low: "brand" } as const;

export function TaskCard({ projectCode, milestoneId, task, manager, mine, locked, employees, minDate, maxDate }: Props) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const canMove = manager || (mine && !locked && task.status !== "done");
  const options = Object.entries(TASK_STATUS).filter(([key]) => manager || key !== "done") as [TaskStatus, string][];

  return (
    <article
      draggable={canMove && !pending}
      onDragStart={(event) => { event.dataTransfer.setData("application/x-neon-task", JSON.stringify({ id: task.id, status: task.status })); event.dataTransfer.effectAllowed = "move"; }}
      className={`rounded-xl border border-line bg-white p-3 text-sm text-ink shadow-sm ${canMove ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{task.title}</p>
        <Badge tone={tone[task.priority as keyof typeof tone] ?? "brand"}>{PRIORITY[task.priority as keyof typeof PRIORITY]}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">{task.code}{task.assigneeCode ? ` · ${task.assigneeCode}` : " · Unassigned"}{task.dueDate ? ` · due ${task.dueDate}` : ""}</p>
      {task.description && <div className="rich mt-2 text-muted" dangerouslySetInnerHTML={{ __html: task.description }} />}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canMove ? (
          <select
            value={task.status}
            disabled={pending}
            aria-label={`Status of ${task.title}`}
            onChange={(e) => start(async () => { const r = await moveTaskAction(projectCode, task.id, e.target.value as TaskStatus); toast(r.ok, r.message); })}
            className="h-9 rounded-lg border border-line bg-white px-2 text-xs"
          >
            {options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        ) : <Badge tone="success">{TASK_STATUS[task.status as TaskStatus]}</Badge>}
        {manager && (
          <DialogButton label="Edit task" title="Edit task" subtitle={`${task.code} · ${task.title}`} icon={<Pencil className="h-4 w-4" />}>
            <TaskForm projectCode={projectCode} milestoneId={milestoneId} task={task} employees={employees} manager={manager} minDate={minDate} maxDate={maxDate} />
          </DialogButton>
        )}
        {manager && (
          <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title={`Delete ${task.code}?`} text={`“${task.title}” will be removed. This cannot be undone.`} confirmLabel="Delete" run={() => deleteTaskAction(projectCode, task.id)} />
        )}
      </div>
    </article>
  );
}
