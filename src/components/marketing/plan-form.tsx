"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm, useFieldError } from "@/components/ui/form";
import { POST_STATUS, POST_TYPES } from "@/lib/marketing";
import { savePlanAction } from "@/server/marketing-actions";

type Post = { date: string; time: string; topic: string; type: string; status: string };
const AD_FIELDS = [
  ["date", "Date"], ["time", "Time"], ["platforms", "Platforms"], ["adType", "Ad type"], ["objective", "Goal"],
  ["target", "Who to reach"], ["product", "Product"], ["offer", "Offer"], ["duration", "How long"], ["message", "Message"], ["creative", "Creative"],
] as const;
type Ad = Record<(typeof AD_FIELDS)[number][0], string>;
export type PlanMonth = { label: string; startDate: string; endDate: string; theme: string; posts: Post[]; ad: Ad };
type Props = {
  id?: string; clients: { code: string; name: string }[];
  values: { clientCode: string; title: string; startDate: string; endDate: string; address: string; cadence: string; confirmNotes: string };
  months: PlanMonth[];
};

const blankAd = (): Ad => ({ date: "", time: "", platforms: "", adType: "", objective: "", target: "", product: "", offer: "", duration: "", message: "", creative: "" });
const blankPost = (): Post => ({ date: "", time: "", topic: "", type: "Poster", status: "Pending" });
const blankMonth = (n: number): PlanMonth => ({ label: `Month ${n}`, startDate: "", endDate: "", theme: "", posts: [], ad: blankAd() });
const small = "h-10 w-full rounded-lg border border-line bg-white px-2.5 text-sm";

function MonthsError() {
  const error = useFieldError("months");
  return error ? <p className="text-xs font-medium text-danger">{error}</p> : null;
}

export function PlanForm({ id, clients, values, months: initial }: Props) {
  const [months, setMonths] = useState<PlanMonth[]>(initial.length ? initial : [blankMonth(1)]);
  const patch = (i: number, change: Partial<PlanMonth>) => setMonths((all) => all.map((m, k) => (k === i ? { ...m, ...change } : m)));
  const patchPost = (i: number, j: number, change: Partial<Post>) => patch(i, { posts: (months[i]?.posts ?? []).map((p, k) => (k === j ? { ...p, ...change } : p)) });

  return (
    <ActionForm action={savePlanAction} submit="Save plan" toastOnSuccess={false} className="space-y-6">
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="months" value={JSON.stringify(months)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Client" required name="clientCode" defaultValue={values.clientCode}>
          <option value="" disabled>Choose a client</option>
          {clients.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
        </SelectField>
        <Field label="Plan title" required name="title" defaultValue={values.title} />
        <Field label="Start date" required name="startDate" type="date" defaultValue={values.startDate} />
        <Field label="End date" required name="endDate" type="date" defaultValue={values.endDate} />
        <Field label="Address" name="address" defaultValue={values.address} />
        <Field label="How often we post" name="cadence" defaultValue={values.cadence} />
      </div>
      <TextareaField label="Notes for the client" name="confirmNotes" defaultValue={values.confirmNotes} rows={3} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Months</h2>
          <button type="button" onClick={() => setMonths((all) => [...all, blankMonth(all.length + 1)])} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-brand-50"><Plus className="h-4 w-4" />Add month</button>
        </div>
        <MonthsError />
        {months.map((m, i) => (
          <section key={i} className="space-y-4 rounded-2xl border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1.5 text-sm font-medium">Month<input className={small} value={m.label} onChange={(e) => patch(i, { label: e.target.value })} /></label>
              <label className="space-y-1.5 text-sm font-medium">From<input type="date" className={small} value={m.startDate} onChange={(e) => patch(i, { startDate: e.target.value })} /></label>
              <label className="space-y-1.5 text-sm font-medium">To<input type="date" className={small} value={m.endDate} onChange={(e) => patch(i, { endDate: e.target.value })} /></label>
              <label className="space-y-1.5 text-sm font-medium">Theme<input className={small} value={m.theme} onChange={(e) => patch(i, { theme: e.target.value })} /></label>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Posts</p>
              {m.posts.map((p, j) => (
                <div key={j} className="grid gap-2 rounded-xl bg-brand-50/50 p-2 sm:grid-cols-[130px_100px_1fr_110px_120px_40px]">
                  <input type="date" aria-label="Post date" className={small} value={p.date} onChange={(e) => patchPost(i, j, { date: e.target.value })} />
                  <input aria-label="Post time" placeholder="Time" className={small} value={p.time} onChange={(e) => patchPost(i, j, { time: e.target.value })} />
                  <input aria-label="Post topic" placeholder="Topic" className={small} value={p.topic} onChange={(e) => patchPost(i, j, { topic: e.target.value })} />
                  <select aria-label="Post type" className={small} value={p.type} onChange={(e) => patchPost(i, j, { type: e.target.value })}>{POST_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                  <select aria-label="Post status" className={small} value={p.status} onChange={(e) => patchPost(i, j, { status: e.target.value })}>{POST_STATUS.map((t) => <option key={t}>{t}</option>)}</select>
                  <button type="button" aria-label="Remove post" onClick={() => patch(i, { posts: m.posts.filter((_, k) => k !== j) })} className="inline-flex h-10 items-center justify-center rounded-lg text-danger hover:bg-white"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => patch(i, { posts: [...m.posts, blankPost()] })} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-brand-50"><Plus className="h-4 w-4" />Add post</button>
            </div>

            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-sm font-semibold">Paid ad for this month</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {AD_FIELDS.map(([key, label]) => (
                  <label key={key} className="space-y-1.5 text-sm font-medium">{label}
                    <input className={small} type={key === "date" ? "date" : "text"} value={m.ad[key]} onChange={(e) => patch(i, { ad: { ...m.ad, [key]: e.target.value } })} />
                  </label>
                ))}
              </div>
            </details>

            {months.length > 1 && (
              <button type="button" onClick={() => setMonths((all) => all.filter((_, k) => k !== i))} className="inline-flex items-center gap-2 text-sm font-semibold text-danger"><Trash2 className="h-4 w-4" />Remove this month</button>
            )}
          </section>
        ))}
      </div>
    </ActionForm>
  );
}
