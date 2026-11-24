"use client";

import { useState } from "react";
import { Field, SelectField } from "@/components/ui/field";
import { RichText } from "@/components/ui/rich-text";
import { ActionForm } from "@/components/ui/form";
import { PRIORITY, TASK_STATUS } from "@/lib/projects";
import { saveTaskAction } from "@/server/task-actions";

type MilestoneOption = { id: string; title: string; department: "software" | "marketing"; finished: boolean; assignees: string[]; startDate?: string; dueDate?: string };
type Props = { projectCode: string; milestones: MilestoneOption[]; employees: { username: string; label: string; marketing: boolean }[] };

/** Add a task from the projects list: pick the milestone first, then one of the employees who are on that milestone. */
export function QuickTaskForm({ projectCode, milestones, employees }: Props) {
  const [milestoneId, setMilestoneId] = useState("");
  if (milestones.length === 0) return <p className="text-sm text-muted">This project has no milestones yet. Add a milestone first, then add tasks to it.</p>;
  const chosen = milestones.find((m) => m.id === milestoneId);
  // Only the employees of the milestone's own team: Software for a software milestone, Marketing for a marketing one.
  const pool = chosen ? employees.filter((e) => chosen.assignees.includes(e.username) && e.marketing === (chosen.department === "marketing")) : [];
  return (
    <ActionForm action={saveTaskAction} submit="Add task" resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="projectCode" value={projectCode} />
      <div className="sm:col-span-2">
        <SelectField label="Milestone" name="milestoneId" required value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
          <option value="">Choose a milestone</option>
          {milestones.map((m) => <option key={m.id} value={m.id}>{m.title} · {m.department === "marketing" ? "Marketing" : "Software"}{m.finished ? " · finished" : ""}</option>)}
        </SelectField>
      </div>
      <SelectField label="Assigned to" name="assigneeCode" defaultValue="" key={milestoneId} disabled={!chosen}>
        <option value="">{!chosen ? "Choose a milestone first" : pool.length ? "Nobody yet" : "No employees on this milestone"}</option>
        {pool.map((e) => <option key={e.username} value={e.username}>{e.label}</option>)}
      </SelectField>
      <SelectField label="Priority" name="priority" defaultValue="medium">
        {Object.entries(PRIORITY).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </SelectField>
      <div className="sm:col-span-2"><Field label="Task" name="title" required /></div>
      <SelectField label="Status" name="status" defaultValue="not-started">
        {Object.entries(TASK_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </SelectField>
      <span />
      <Field label="Start" name="startDate" type="date" min={chosen?.startDate || undefined} max={chosen?.dueDate || undefined} />
      <Field label="Due" name="dueDate" type="date" min={chosen?.startDate || undefined} max={chosen?.dueDate || undefined} />
      <div className="sm:col-span-2"><RichText label="Details" name="description" placeholder="Add the task breakdown, links or notes." /></div>
    </ActionForm>
  );
}
