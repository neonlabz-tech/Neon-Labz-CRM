import { ProjectSelect } from "@/components/reports/forms";
import { Field, SelectField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { MEETING_STATUS, RECURRENCES } from "@/lib/meetings";
import { saveMeetingAction } from "@/server/meeting-actions";

export type MeetingValues = { id?: string; projectCode: string; startDate: string; time: string; link: string; recurrence: string; status?: string; nextDate?: string };

export function MeetingForm({ values, projects }: { values: MeetingValues; projects: { code: string; name: string }[] }) {
  return (
    <ActionForm action={saveMeetingAction} submit="Save meeting" toastOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="sm:col-span-2"><ProjectSelect projects={projects} value={values.projectCode} /></div>
      <Field label="Date" name="startDate" type="date" defaultValue={values.startDate} required />
      <Field label="Time" name="time" type="time" defaultValue={values.time} required />
      <Field label="Meeting link" name="link" defaultValue={values.link} maxLength={300} required />
      <SelectField label="Repeats" name="recurrence" defaultValue={values.recurrence}>
        {Object.entries(RECURRENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </SelectField>
      {values.id && (
        <SelectField label={`Status for ${values.nextDate ?? "the next date"}`} name="status" defaultValue={values.status ?? "scheduled"}>
          {Object.entries(MEETING_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
      )}
    </ActionForm>
  );
}
