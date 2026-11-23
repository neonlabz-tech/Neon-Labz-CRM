import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import type { ActionState } from "@/types";
import { saveSrsAction, saveVideoAction } from "@/server/report-actions";

type Project = { code: string; name: string };
const Hidden = ({ id }: { id?: string }) => (id ? <input type="hidden" name="id" value={id} /> : null);
export const ProjectSelect = ({ projects, value }: { projects: Project[]; value: string }) => (
  <SelectField label="Project" required name="projectCode" defaultValue={value}>
    <option value="" disabled>{projects.length ? "Select a project" : "No projects yet"}</option>
    {projects.map((p) => <option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}
  </SelectField>
);

export type SrsValues = { id?: string; projectCode: string; title: string; preparedFor: string; date: string; introduction: string; functional: string; nonFunctional: string; assumptions: string };

type SaveAction = (state: ActionState, data: FormData) => Promise<ActionState>;

/** `action` and `picker` let another area (Special Clients) use the same form for its own save and its own "who is it for" choice. */
export function SrsForm({ values, projects = [], action = saveSrsAction, picker }: { values: SrsValues; projects?: Project[]; action?: SaveAction; picker?: React.ReactNode }) {
  return (
    <ActionForm action={action} submit="Save document" toastOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
      <Hidden id={values.id} />
      <div className="sm:col-span-2">{picker ?? <ProjectSelect projects={projects} value={values.projectCode} />}</div>
      <Field label="Document title" required name="title" defaultValue={values.title} maxLength={200} />
      <Field label="Prepared for" name="preparedFor" defaultValue={values.preparedFor} maxLength={300} />
      <Field label="Date" name="date" type="date" defaultValue={values.date} />
      <div className="sm:col-span-2"><TextareaField label="Introduction" name="introduction" defaultValue={values.introduction} rows={4} /></div>
      <div className="sm:col-span-2"><TextareaField label="Functional requirements" name="functional" defaultValue={values.functional} rows={5} placeholder="One requirement per line" /></div>
      <div className="sm:col-span-2"><TextareaField label="Non-functional requirements" name="nonFunctional" defaultValue={values.nonFunctional} rows={4} placeholder="One requirement per line" /></div>
      <div className="sm:col-span-2"><TextareaField label="Assumptions" name="assumptions" defaultValue={values.assumptions} rows={3} placeholder="One assumption per line" /></div>
    </ActionForm>
  );
}

export type VideoValues = { id?: string; projectCode: string; title: string; date: string; url: string; notes: string };

export function VideoForm({ values, projects }: { values: VideoValues; projects: Project[] }) {
  return (
    <ActionForm action={saveVideoAction} submit="Save video" toastOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
      <Hidden id={values.id} />
      <div className="sm:col-span-2"><ProjectSelect projects={projects} value={values.projectCode} /></div>
      <Field label="Title" required name="title" defaultValue={values.title} maxLength={200} />
      <Field label="Date" name="date" type="date" defaultValue={values.date} />
      <div className="sm:col-span-2"><Field label="Video link" name="url" defaultValue={values.url} placeholder="https://" /></div>
      <div className="sm:col-span-2"><TextareaField label="Notes" name="notes" defaultValue={values.notes} rows={3} /></div>
    </ActionForm>
  );
}
