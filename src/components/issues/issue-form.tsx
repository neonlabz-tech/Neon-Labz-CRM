import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ISSUE_TYPES } from "@/lib/issues";
import { saveIssueAction } from "@/server/issue-actions";

export type IssueValues = { id?: string; title: string; projectCode: string; status: string; priority: string; type: string; assignee: string; dueDate: string; description: string; steps: string; expected: string };
const labels = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => <option key={value} value={value}>{label}</option>);

export function IssueForm({ values, projects, members }: { values: IssueValues; projects: { code: string; name: string }[]; members: { username: string; name: string }[] }) {
  return (
    <ActionForm action={saveIssueAction} submit="Save issue" toastOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="sm:col-span-2"><Field label="Title" required name="title" defaultValue={values.title} maxLength={200} /></div>
      <SelectField label="Project" required name="projectCode" defaultValue={values.projectCode}>
        <option value="" disabled>Choose a project</option>
        {projects.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}
      </SelectField>
      <SelectField label="Type" required name="type" defaultValue={values.type}>{labels(ISSUE_TYPES)}</SelectField>
      <SelectField label="Status" required name="status" defaultValue={values.status}>{labels(ISSUE_STATUSES)}</SelectField>
      <SelectField label="Priority" required name="priority" defaultValue={values.priority}>{labels(ISSUE_PRIORITIES)}</SelectField>
      <SelectField label="Assigned to" name="assignee" defaultValue={values.assignee}>
        <option value="">Nobody yet</option>
        {members.map((m) => <option key={m.username} value={m.username}>{m.name} · {m.username}</option>)}
      </SelectField>
      <Field label="Due date" name="dueDate" type="date" defaultValue={values.dueDate} />
      <div className="sm:col-span-2"><TextareaField label="What is wrong" name="description" defaultValue={values.description} rows={3} /></div>
      <TextareaField label="Steps to repeat it" name="steps" defaultValue={values.steps} rows={3} />
      <TextareaField label="What should happen" name="expected" defaultValue={values.expected} rows={3} />
    </ActionForm>
  );
}
