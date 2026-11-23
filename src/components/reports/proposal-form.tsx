"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { saveProposalAction } from "@/server/report-actions";
import type { ActionState } from "@/types";
import { ProjectSelect } from "./forms";

type Row = Record<string, string>;
export type ProposalValues = Record<string, string> & { id?: string };
type Lists = { stack: Row[]; brand: Row[]; packageStats: Row[]; budget: Row[] };

const small = "h-10 w-full rounded-lg border border-line bg-white px-2.5 text-sm";
const LAYERS = ["Frontend", "Backend", "Database", "Payment Gateway", "Production Hosting"];

/** A small editable table. Rows are sent to the server as JSON. */
function RowsEditor({ name, columns, rows, onChange, blank, addLabel }: {
  name: string; columns: [string, string][]; rows: Row[]; onChange: (rows: Row[]) => void; blank: Row; addLabel: string;
}) {
  const set = (i: number, key: string, value: string) => onChange(rows.map((r, k) => (k === i ? { ...r, [key]: value } : r)));
  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 rounded-xl bg-brand-50/50 p-2 sm:grid-cols-(--cols)" style={{ "--cols": `repeat(${columns.length}, minmax(0, 1fr)) 40px` } as React.CSSProperties}>
          {columns.map(([key, label]) => (
            <input key={key} aria-label={label} placeholder={label} className={small} value={row[key] ?? ""} onChange={(e) => set(i, key, e.target.value)} />
          ))}
          <button type="button" aria-label="Remove row" onClick={() => onChange(rows.filter((_, k) => k !== i))} className="inline-flex h-10 items-center justify-center rounded-lg text-danger hover:bg-white"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { ...blank }])} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-brand-50"><Plus className="h-4 w-4" />{addLabel}</button>
    </div>
  );
}

type SaveAction = (state: ActionState, data: FormData) => Promise<ActionState>;

/** `action` and `picker` let another area (Special Clients) use the same form for its own save and its own "who is it for" choice. */
export function ProposalForm({ values, lists, projects = [], action = saveProposalAction, picker }: { values: ProposalValues; lists: Partial<Lists>; projects?: { code: string; name: string }[]; action?: SaveAction; picker?: React.ReactNode }) {
  const [stack, setStack] = useState<Row[]>(lists.stack?.length ? lists.stack : LAYERS.map((layer) => ({ layer, technology: "", purpose: "" })));
  const [brand, setBrand] = useState<Row[]>(lists.brand?.length ? lists.brand : [{ title: "", text: "" }, { title: "", text: "" }, { title: "", text: "" }]);
  const [stats, setStats] = useState<Row[]>(lists.packageStats?.length ? lists.packageStats : [{ value: "", label: "" }, { value: "", label: "" }, { value: "", label: "" }]);
  const [budget, setBudget] = useState<Row[]>(lists.budget?.length ? lists.budget : [{ deliverable: "", fee: "", amount: "" }]);
  const v = (key: string) => values[key] ?? "";
  const two = "grid gap-4 sm:grid-cols-2";
  const full = "sm:col-span-2";

  return (
    <ActionForm action={action} submit="Save proposal" toastOnSuccess={false} className="space-y-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {picker ?? <ProjectSelect projects={projects} value={v("projectCode")} />}

      <section className="space-y-4"><h3 className="font-semibold">1. Basic details</h3>
        <div className={two}>
          <div className={full}><Field label="Proposal title" required name="title" defaultValue={v("title")} maxLength={200} placeholder="E-Commerce Platform & Digital Marketing Proposal" /></div>
          <div className={full}><Field label="Subtitle" name="subtitle" defaultValue={v("subtitle")} maxLength={300} /></div>
          <Field label="Prepared for" name="preparedFor" defaultValue={v("preparedFor")} maxLength={300} />
          <Field label="Date" name="date" type="date" defaultValue={v("date")} />
          <Field label="Proposal validity" name="validity" defaultValue={v("validity")} placeholder="14 days" />
          <div className={full}><TextareaField label="Client details, company and scope" name="companyScope" defaultValue={v("companyScope")} rows={3} /></div>
          <div className={full}><TextareaField label="Proposal summary" name="summary" defaultValue={v("summary")} rows={4} /></div>
        </div>
      </section>

      <section className="space-y-4"><h3 className="font-semibold">2. Website and dashboards</h3>
        <div className={two}>
          <Field label="Customer dashboard title" name="customerTitle" defaultValue={v("customerTitle")} />
          <Field label="Customer role" name="customerRole" defaultValue={v("customerRole")} />
          <div className={full}><TextareaField label="Customer features" name="customerFeatures" defaultValue={v("customerFeatures")} rows={4} placeholder="One feature per line" /></div>
          <Field label="Admin dashboard title" name="adminTitle" defaultValue={v("adminTitle")} />
          <Field label="Admin role" name="adminRole" defaultValue={v("adminRole")} />
          <div className={full}><TextareaField label="Admin features" name="adminFeatures" defaultValue={v("adminFeatures")} rows={4} placeholder="One feature per line" /></div>
        </div>
      </section>

      <section className="space-y-3"><h3 className="font-semibold">3. Technical setup</h3>
        <RowsEditor name="stack" columns={[["layer", "Layer"], ["technology", "Technology"], ["purpose", "Purpose"]]} rows={stack} onChange={setStack} blank={{ layer: "", technology: "", purpose: "" }} addLabel="Add layer" />
      </section>

      <section className="space-y-3"><h3 className="font-semibold">4. Marketing and branding</h3>
        <RowsEditor name="brand" columns={[["title", "Title, such as tagline or brand voice"], ["text", "Description"]]} rows={brand} onChange={setBrand} blank={{ title: "", text: "" }} addLabel="Add item" />
        <div className={two}>
          <Field label="Package name" name="packageName" defaultValue={v("packageName")} placeholder="Complimentary Marketing Package" />
          <Field label="Package investment" name="packageInvestment" defaultValue={v("packageInvestment")} placeholder="0" />
        </div>
        <RowsEditor name="packageStats" columns={[["value", "Figure, e.g. 24"], ["label", "Label, e.g. Social posts"]]} rows={stats} onChange={setStats} blank={{ value: "", label: "" }} addLabel="Add figure" />
      </section>

      <section className="space-y-3"><h3 className="font-semibold">5. Budget, payment and timeline</h3>
        <RowsEditor name="budget" columns={[["deliverable", "Deliverable"], ["fee", "One-time fee, e.g. Included"], ["amount", "Investment (LKR)"]]} rows={budget} onChange={setBudget} blank={{ deliverable: "", fee: "", amount: "" }} addLabel="Add deliverable" />
        <div className={two}>
          <Field label="Total project cost (LKR)" name="totalAmount" defaultValue={v("totalAmount")} />
          <Field label="Total note" name="totalNote" defaultValue={v("totalNote")} placeholder="Taxes and third-party fees are confirmed separately." />
          <Field label="Total duration" name="duration" defaultValue={v("duration")} placeholder="11 weeks (2.5 months)" />
          <Field label="Earliest start" name="startDate" type="date" defaultValue={v("startDate")} />
          <Field label="Production launch" name="launchDate" type="date" defaultValue={v("launchDate")} />
        </div>
      </section>

      <section className="space-y-4"><h3 className="font-semibold">6. Scope, terms and acceptance</h3>
        <div className={two}>
          <div className={full}><TextareaField label="Terms" name="terms" defaultValue={v("terms")} rows={4} placeholder="One term per line" /></div>
          <Field label="Client signatory" name="clientSignName" defaultValue={v("clientSignName")} />
          <Field label="Client title" name="clientSignTitle" defaultValue={v("clientSignTitle")} />
          <Field label="Client date" name="clientSignDate" type="date" defaultValue={v("clientSignDate")} />
          <Field label="Neon Labz signatory" name="companySignName" defaultValue={v("companySignName")} />
          <Field label="Neon Labz title" name="companySignTitle" defaultValue={v("companySignTitle")} />
          <Field label="Neon Labz date" name="companySignDate" type="date" defaultValue={v("companySignDate")} />
        </div>
      </section>
    </ActionForm>
  );
}
