import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { CallFields } from "@/components/leads/call-fields";
import { todayISO } from "@/lib/dates";
import { CALL_OUTCOMES, LEAD_SERVICES, LEAD_SOURCES, LEAD_STAGES } from "@/models/lead";
import { saveLeadAction } from "@/server/lead-actions";

export type LeadDefaults = {
  id?: string; date: string; business?: string; phone?: string; email?: string; address?: string; businessType?: string;
  source?: string; service?: string; status?: string; notes?: string;
};

export function LeadForm({ defaults }: { defaults: LeadDefaults }) {
  const editing = Boolean(defaults.id);
  return (
    <ActionForm action={saveLeadAction} submit={editing ? "Save lead" : "Add lead"} toastOnSuccess={false} className="space-y-6">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business or customer name" name="business" defaultValue={defaults.business} required />
        <Field label="Lead date" name="date" type="date" defaultValue={defaults.date} min={editing && defaults.date < todayISO() ? defaults.date : todayISO()} required />
        <Field label="Phone" name="phone" inputMode="tel" placeholder="077-123-4567" defaultValue={defaults.phone} />
        <Field label="Email" name="email" type="email" defaultValue={defaults.email} />
        <Field label="Address" name="address" defaultValue={defaults.address} />
        <Field label="Type of business" name="businessType" defaultValue={defaults.businessType} />
        <SelectField label="Where did the lead come from?" name="source" defaultValue={defaults.source ?? "Other"}>
          {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
        </SelectField>
        <SelectField label="Service they want" name="service" defaultValue={defaults.service ?? LEAD_SERVICES[0]}>
          {LEAD_SERVICES.map((s) => <option key={s}>{s}</option>)}
        </SelectField>
        {editing && (
          <SelectField label="Stage" name="status" defaultValue={defaults.status}>
            {LEAD_STAGES.map((s) => <option key={s}>{s}</option>)}
          </SelectField>
        )}
        <div className="sm:col-span-2"><TextareaField label="Notes" name="notes" defaultValue={defaults.notes} /></div>
      </div>

      <CallFields today={todayISO()} outcomes={CALL_OUTCOMES} stages={LEAD_STAGES} />
    </ActionForm>
  );
}
