import { Field, SelectField } from "@/components/ui/field";
import { RichText } from "@/components/ui/rich-text";
import { ActionForm } from "@/components/ui/form";
import { PRIORITY, TASK_STATUS } from "@/lib/projects";
import { saveTaskAction } from "@/server/task-actions";

export type TaskView = {
  id: string; code: string; title: string; priority: string; assigneeCode: string; startDate: string; dueDate: string;
  description: string; status: string;
};
type Props = { projectCode: string; milestoneId: string; task?: TaskView; employees: { username: string; label: string }[]; manager: boolean };

export function TaskForm({ projectCode, milestoneId, task, employees, manager }: Props) {
  const statuses = Object.entries(TASK_STATUS).filter(([key]) => manager || key !== "done");
  return (
    <ActionForm action={saveTaskAction} submit={task ? "Save task" : "Add task"} resetOnSuccess={!task} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="projectCode" value={projectCode} />
      <input type="hidden" name="milestoneId" value={milestoneId} />
      {task && <input type="hidden" name="id" value={task.id} />}
      <div className="sm:col-span-2"><Field label="Task" name="title" defaultValue={task?.title} required /></div>
      <SelectField label="Priority" name="priority" defaultValue={task?.priority ?? "medium"}>
        {Object.entries(PRIORITY).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </SelectField>
      <SelectField label="Status" name="status" defaultValue={task?.status ?? "not-started"}>
        {statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </SelectField>
      {manager && (
        <SelectField label="Assigned to" name="assigneeCode" defaultValue={task?.assigneeCode ?? ""}>
          <option value="">Nobody yet</option>
          {employees.map((e) => <option key={e.username} value={e.username}>{e.label}</option>)}
        </SelectField>
      )}
      <Field label="Start" name="startDate" type="date" defaultValue={task?.startDate} />
      <Field label="Due" name="dueDate" type="date" defaultValue={task?.dueDate} />
      <div className="sm:col-span-2"><RichText label="Details" name="description" defaultValue={task?.description} placeholder="Add the task breakdown, links or notes." /></div>
    </ActionForm>
  );
}
