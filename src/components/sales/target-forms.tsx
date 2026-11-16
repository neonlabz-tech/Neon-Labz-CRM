import { Field } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { saveSalesSettingsAction, saveStaffTargetAction } from "@/server/sales-target-actions";

const grid = "grid gap-4 sm:grid-cols-2";

export function StaffTargetForm({ values }: { values: { username: string; name: string; target: string; rate: string; dailyLeads: string; dailyCalls: string } }) {
  return (
    <ActionForm action={saveStaffTargetAction} submit="Save" toastOnSuccess={false} className={grid}>
      <input type="hidden" name="username" value={values.username} />
      <div className="sm:col-span-2"><Field label="Display name" required name="name" defaultValue={values.name} maxLength={80} /></div>
      <Field label="Monthly target (LKR)" required name="target" type="number" min="0" defaultValue={values.target} />
      <Field label="Commission rate (%)" required name="rate" type="number" min="0" max="100" step="0.1" defaultValue={values.rate} />
      <Field label="Daily new leads" required name="dailyLeads" type="number" min="0" step="1" defaultValue={values.dailyLeads} />
      <Field label="Daily answered calls" required name="dailyCalls" type="number" min="0" step="1" defaultValue={values.dailyCalls} />
    </ActionForm>
  );
}

export function SalesSettingsForm({ values }: { values: { monthlyTarget: string; dailyLeads: string; dailyCalls: string; defaultRate: string } }) {
  return (
    <ActionForm action={saveSalesSettingsAction} submit="Save settings" className={grid}>
      <Field label="Company monthly sales target (LKR)" required name="monthlyTarget" type="number" min="0" defaultValue={values.monthlyTarget} />
      <Field label="Default commission rate (%)" required name="defaultRate" type="number" min="0" max="100" step="0.1" defaultValue={values.defaultRate} />
      <Field label="Daily new leads target" required name="dailyLeads" type="number" min="0" step="1" defaultValue={values.dailyLeads} />
      <Field label="Daily answered calls target" required name="dailyCalls" type="number" min="0" step="1" defaultValue={values.dailyCalls} />
    </ActionForm>
  );
}
