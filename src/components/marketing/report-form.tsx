"use client";

import { FileField } from "@/components/ui/file-field";
import { useState } from "react";
import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { REPORT_PLATFORMS, STAT_SECTIONS } from "@/lib/marketing";
import { cn } from "@/lib/utils";
import { saveReportAction } from "@/server/marketing-actions";

export type PlatformValues = Record<string, string | string[]>;
type Props = {
  id?: string;
  clients: { code: string; name: string }[];
  values: { clientCode: string; title: string; startDate: string; endDate: string; contentDirection: string; clientSummary: string; nextActions: string[] };
  platforms: Record<string, PlatformValues>;
};

export function ReportForm({ id, clients, values, platforms }: Props) {
  const [active, setActive] = useState<string>(REPORT_PLATFORMS[0][0]);
  const [actions, setActions] = useState(values.nextActions.length ? values.nextActions : [""]);
  const filled = (p: string) => Object.entries(platforms[p] ?? {}).some(([, v]) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));

  return (
    <ActionForm action={saveReportAction} submit="Save report" toastOnSuccess={false} className="space-y-6">
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Client" required name="clientCode" defaultValue={values.clientCode}>
          <option value="" disabled>Select a client</option>
          {clients.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
        </SelectField>
        <Field label="Report title" name="title" defaultValue={values.title} maxLength={200} />
        <Field label="Period start" required name="startDate" type="date" defaultValue={values.startDate} />
        <Field label="Period end" required name="endDate" type="date" defaultValue={values.endDate} />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-brand-50 p-1" role="tablist" aria-label="Social platforms">
        {REPORT_PLATFORMS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => setActive(key)}
            className={cn("whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold", active === key ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink")}>
            {label}{filled(key) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" />}
          </button>
        ))}
      </div>

      {REPORT_PLATFORMS.map(([key, label]) => {
        const data = platforms[key] ?? {};
        const images = (data.analysisImages as string[] | undefined) ?? [];
        return (
          <div key={key} hidden={active !== key} className="space-y-6">
            {STAT_SECTIONS.map((section) => (
              <section key={section.title} className="space-y-3">
                <h3 className="font-semibold">{section.title}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {section.fields.map(([field, text, area]) => (
                    <div key={field} className={area ? "sm:col-span-2" : ""}>
                      {area
                        ? <TextareaField label={text} name={`${key}_${field}`} defaultValue={(data[field] as string) ?? ""} rows={3} />
                        : <Field label={text} name={`${key}_${field}`} defaultValue={(data[field] as string) ?? ""} />}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <section className="space-y-3">
              <h3 className="font-semibold">Final analysis</h3>
              
              {images.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {images.map((src) => (
                    <li key={src} className="rounded-xl border border-line p-2 text-xs">
                      <Image src={src} alt={`${label} analysis`} width={160} height={120} unoptimized className="h-24 w-full rounded-lg object-cover" />
                      <label className="mt-2 flex items-center gap-2"><input type="checkbox" name={`${key}_remove`} value={src} />Remove</label>
                    </li>
                  ))}
                </ul>
              )}
              <FileField label={`${label} screenshots`} name={`${key}_images`} multiple accept="image/jpeg,image/png,image/webp" hint="JPG, PNG or WebP · up to 5 MB each" maxMb={5} />
            </section>
          </div>
        );
      })}

      <section className="space-y-3">
        <h3 className="font-semibold">Insights and client summary</h3>
        {actions.map((value, i) => (
          <div key={i} className="flex gap-2">
            <input name="nextActions" aria-label={`Next action ${i + 1}`} placeholder={`Next action ${i + 1}`} defaultValue={value} className="h-11 w-full rounded-xl border border-line px-3.5 text-sm" />
            {actions.length > 1 && <button type="button" aria-label="Remove action" onClick={() => setActions(actions.filter((_, k) => k !== i))} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-danger hover:bg-brand-50"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
        <button type="button" onClick={() => setActions([...actions, ""])} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-brand-50"><Plus className="h-4 w-4" />Add action</button>
        <TextareaField label="Content direction" name="contentDirection" defaultValue={values.contentDirection} rows={3} />
        <TextareaField label="Client summary" required name="clientSummary" defaultValue={values.clientSummary} rows={4} />
      </section>
    </ActionForm>
  );
}
