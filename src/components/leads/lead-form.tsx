import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { LeadPhone } from "@/components/leads/lead-phone";
import { formatDay } from "@/lib/utils";
import { LEAD_SERVICES, LEAD_SOURCES, LEAD_STAGES } from "@/models/lead";
import { saveLeadAction } from "@/server/lead-actions";

export type LeadDefaults = {
  id?: string; date: string; business?: string; phone?: string; email?: string; address?: string; businessType?: string;
  source?: string; service?: string; status?: string; notes?: string;
};

export function LeadForm({ defaults, uid = "" }: { defaults: LeadDefaults; /** Makes the field ids unique when several lead forms are on one page (the edit window of every row). */ uid?: string }) {
  const editing = Boolean(defaults.id);
  const id = (name: string) => (uid ? `${name}-${uid}` : name);
  return (
    <ActionForm action={saveLeadAction} submit={editing ? "Save lead" : "Add lead"} toastOnSuccess={editing} className="space-y-6">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business or customer name" name="business" id={id("business")} defaultValue={defaults.business} required />
        <Field label="Lead date" value={formatDay(defaults.date)} readOnly tabIndex={-1} className="cursor-not-allowed bg-canvas text-muted" aria-label="Lead date (set automatically)" />
        <LeadPhone defaultValue={defaults.phone} leadId={defaults.id} uid={uid} />
        <Field label="Email" name="email" id={id("email")} type="email" defaultValue={defaults.email} required />
        <Field label="Address" name="address" id={id("address")} defaultValue={defaults.address} />
        <Field label="Type of business" name="businessType" id={id("businessType")} defaultValue={defaults.businessType} />
        <SelectField label="Where did the lead come from?" name="source" id={id("source")} defaultValue={defaults.source ?? "Other"}>
          {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
        </SelectField>
        <SelectField label="Service they want" name="service" id={id("service")} defaultValue={defaults.service ?? LEAD_SERVICES[0]}>
          {LEAD_SERVICES.map((s) => <option key={s}>{s}</option>)}
        </SelectField>
        {editing && (
          <SelectField label="Stage" name="status" id={id("status")} defaultValue={defaults.status}>
            {LEAD_STAGES.map((s) => <option key={s}>{s}</option>)}
          </SelectField>
        )}
        <div className="sm:col-span-2"><TextareaField label="Notes" name="notes" id={id("notes")} defaultValue={defaults.notes} /></div>
      </div>

    </ActionForm>
  );
}
