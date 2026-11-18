"use client";

import { useState } from "react";
import { Field, SelectField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { AUDIENCES, audienceFits, type Audience } from "@/lib/audience";
import type { ProjectType } from "@/lib/projects";
import { saveMilestoneAction } from "@/server/project-actions";

/**
 * Add milestone on the Milestones page: pick the project, then (Super Admin only) who it goes to.
 * Only the teams that work on the chosen project are offered; "Both teams" makes one milestone for each team.
 * A project manager adds to the software part and a marketing head to the marketing part.
 */
export function MilestoneAddForm({ projects, employees, admin, department }: {
  projects: { code: string; name: string; type: ProjectType }[];
  employees: { username: string; label: string }[];
  /** The Super Admin chooses the team. A project manager or marketing head adds to their own part. */
  admin: boolean;
  department: "software" | "marketing";
}) {
  const [code, setCode] = useState("");
  const type = projects.find((p) => p.code === code)?.type;
  const options = (Object.keys(AUDIENCES) as Audience[]).filter((a) => !type || audienceFits(type, a));
  return (
    <ActionForm action={saveMilestoneAction} submit="Add milestone" toastOnSuccess className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <SelectField label="Project" required name="projectCode" value={code} onChange={(event) => setCode(event.target.value)}>
          <option value="" disabled>{projects.length ? "Choose a project" : "No active projects yet"}</option>
          {projects.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}
        </SelectField>
      </div>
      {admin && (
        <div className="sm:col-span-2">
          <SelectField label="Send to" required name="audience" key={options.join()} defaultValue={options.includes("both") ? "both" : options[0]}>
            {options.map((a) => <option key={a} value={a}>{AUDIENCES[a]}</option>)}
          </SelectField>
        </div>
      )}
      <input type="hidden" name="department" value={admin ? "software" : department} />
      <div className="sm:col-span-2"><Field label="Milestone" name="title" required /></div>
      <Field label="Start" name="startDate" type="date" />
      <Field label="Due" required name="dueDate" type="date" />
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Employees on this milestone</legend>
        {employees.length === 0 ? <p className="text-sm text-muted">No employee logins yet.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {employees.map((e) => (
              <label key={e.username} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                <input type="checkbox" name="assignees" value={e.username} />{e.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </ActionForm>
  );
}
