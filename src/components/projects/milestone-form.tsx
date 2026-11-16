import { Field, SelectField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { saveMilestoneAction } from "@/server/project-actions";

type MilestoneView = { id: string; title: string; startDate: string; dueDate: string; department: "software" | "marketing"; assignees: string[] };
type Props = {
  projectCode: string; type: "software" | "marketing" | "both"; allowed: ("software" | "marketing")[];
  employees: { username: string; label: string }[]; milestone?: MilestoneView;
};

export function MilestoneForm({ projectCode, type, allowed, employees, milestone }: Props) {
  return (
    <ActionForm action={saveMilestoneAction} submit={milestone ? "Save milestone" : "Add milestone"} resetOnSuccess={!milestone} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="projectCode" value={projectCode} />
      {milestone && <input type="hidden" name="id" value={milestone.id} />}
      <div className="sm:col-span-2"><Field label="Milestone" name="title" defaultValue={milestone?.title} required /></div>
      <Field label="Start" name="startDate" type="date" defaultValue={milestone?.startDate} />
      <Field label="Due" required name="dueDate" type="date" defaultValue={milestone?.dueDate} />
      {type === "both" ? (
        <SelectField label="Part of the project" required name="department" defaultValue={milestone?.department ?? allowed[0]}>
          {allowed.map((d) => <option key={d} value={d}>{d === "software" ? "Software" : "Marketing"}</option>)}
        </SelectField>
      ) : (
        <input type="hidden" name="department" value={allowed[0] ?? "software"} />
      )}
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Employees on this milestone</legend>
        {employees.length === 0 ? <p className="text-sm text-muted">No employee logins yet.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {employees.map((e) => (
              <label key={e.username} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                <input type="checkbox" name="assignees" value={e.username} defaultChecked={milestone?.assignees.includes(e.username)} />{e.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </ActionForm>
  );
}
