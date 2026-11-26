"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { AUDIENCE_PRESETS, METRIC_PRESETS, REPORT_PLATFORMS, emptyPlatform, type PlatformData, type ReportPost, type ReportRow } from "@/lib/marketing";
import { cn } from "@/lib/utils";
import { saveReportAction } from "@/server/marketing-actions";

type Shot = { key: string; url: string; caption: string };
type State = { intro: string; analysis: string; metrics: ReportRow[]; posts: ReportPost[]; audience: ReportRow[]; shots: Shot[] };

type Props = {
  id?: string;
  clients: { code: string; name: string }[];
  values: { clientCode: string; title: string; startDate: string; endDate: string; contentDirection: string; clientSummary: string; nextActions: string[]; metaSummary: string; metaShots: { url: string; caption: string }[] };
  platforms: Record<string, PlatformData>;
};

const input = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm hover:border-brand-300";
const blankRows = (labels: string[]): ReportRow[] => labels.map((label) => ({ label, value: "" }));
const hasValue = (rows: ReportRow[]) => rows.some((r) => r.label.trim() && r.value.trim());

function initial(platform: string, saved: PlatformData | undefined, counter: () => string): State {
  const data = saved ?? emptyPlatform();
  return {
    intro: data.intro, analysis: data.analysis,
    metrics: data.metrics.length ? data.metrics : blankRows(METRIC_PRESETS[platform] ?? []),
    posts: data.posts,
    audience: data.audience.length ? data.audience : blankRows(AUDIENCE_PRESETS),
    shots: data.shots.map((s) => ({ key: counter(), url: s.url, caption: s.caption })),
  };
}

const listOf = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** A first draft of the client summary, written from the numbers that were entered. The team edits it. */
function draftSummary(client: string, data: Record<string, State>): string {
  const used = REPORT_PLATFORMS.filter(([key]) => hasValue(data[key]?.metrics ?? []));
  if (!used.length) return "";
  const lines = used.map(([key, label]) => {
    const top = data[key]!.metrics.filter((m) => m.label.trim() && m.value.trim()).slice(0, 3);
    return `${label} recorded ${listOf(top.map((m) => `${m.value.trim()} ${m.label.trim().toLowerCase()}`))}.`;
  });
  return `During the reporting period, ${client || "the client"} maintained activity across ${listOf(used.map(([, label]) => label))}. ${lines.join(" ")}`;
}

function RowEditor({ rows, onChange, labelPlaceholder, valuePlaceholder, addText }: { rows: ReportRow[]; onChange: (rows: ReportRow[]) => void; labelPlaceholder: string; valuePlaceholder: string; addText: string }) {
  const set = (i: number, patch: Partial<ReportRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input aria-label={labelPlaceholder} placeholder={labelPlaceholder} value={row.label} onChange={(e) => set(i, { label: e.target.value })} className={input} maxLength={120} />
          <input aria-label={valuePlaceholder} placeholder={valuePlaceholder} value={row.value} onChange={(e) => set(i, { value: e.target.value })} className={input} maxLength={200} />
          <button type="button" aria-label="Remove row" onClick={() => onChange(rows.filter((_, k) => k !== i))} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-danger hover:bg-brand-50"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { label: "", value: "" }])} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-brand-50"><Plus className="h-4 w-4" />{addText}</button>
    </div>
  );
}

export function ReportForm({ id, clients, values, platforms }: Props) {
  const counter = useRef(0);
  const nextKey = () => `s${(counter.current += 1)}`;
  const [active, setActive] = useState<string>(REPORT_PLATFORMS[0][0]);
  const [data, setData] = useState<Record<string, State>>(() => Object.fromEntries(REPORT_PLATFORMS.map(([key]) => [key, initial(key, platforms[key], nextKey)])));
  const [actions, setActions] = useState(values.nextActions.length ? values.nextActions : [""]);
  const [clientCode, setClientCode] = useState(values.clientCode);
  const [summary, setSummary] = useState(values.clientSummary);
  const [metaShots, setMetaShots] = useState<Shot[]>(() => values.metaShots.map((s) => ({ key: nextKey(), url: s.url, caption: s.caption })));

  const patch = (platform: string, next: Partial<State>) => setData((all) => ({ ...all, [platform]: { ...all[platform]!, ...next } }));
  const filled = (platform: string) => {
    const d = data[platform]!;
    return hasValue(d.metrics) || hasValue(d.audience) || d.posts.some((p) => p.title.trim()) || d.shots.length > 0 || Boolean(d.intro.trim() || d.analysis.trim());
  };
  const clientName = clients.find((c) => c.code === clientCode)?.name ?? "";

  return (
    <ActionForm action={saveReportAction} submit="Save report" toastOnSuccess={false} className="space-y-6">
      {id && <input type="hidden" name="id" value={id} />}
      {REPORT_PLATFORMS.map(([key]) => {
        const d = data[key]!;
        return <input key={key} type="hidden" name={`${key}_data`} value={JSON.stringify({ intro: d.intro, analysis: d.analysis, metrics: d.metrics, posts: d.posts, audience: d.audience, shots: d.shots })} />;
      })}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Client" required name="clientCode" value={clientCode} onChange={(e) => setClientCode(e.target.value)}>
          <option value="" disabled>Select a client</option>
          {clients.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
        </SelectField>
        <Field label="Report title" name="title" defaultValue={values.title} maxLength={200} placeholder="Social Media Completion Report" />
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
        const d = data[key]!;
        return (
          <div key={key} hidden={active !== key} className="space-y-6">
            <p className="text-sm text-muted">Fill only what this platform has. Empty rows are left out of the PDF.</p>
            <TextareaField label="Intro line (optional)" name={`${key}_intro_note`} rows={2} value={d.intro} onChange={(e) => patch(key, { intro: e.target.value })} placeholder={`For example: The ${label} screenshots show the analytics window 3 October – 1 November.`} />

            <section className="space-y-3">
              <h3 className="font-semibold">{label} numbers</h3>
              <p className="text-xs text-muted">Type the value next to each metric. Change a name or add your own metric if needed.</p>
              <RowEditor rows={d.metrics} onChange={(metrics) => patch(key, { metrics })} labelPlaceholder="Metric" valuePlaceholder="Result" addText="Add metric" />
            </section>

            <TextareaField label="What the numbers show (optional)" name={`${key}_analysis_note`} rows={2} value={d.analysis} onChange={(e) => patch(key, { analysis: e.target.value })} />

            <section className="space-y-3">
              <h3 className="font-semibold">Top-performing posts</h3>
              {d.posts.map((post, i) => (
                <div key={i} className="grid grid-cols-[1fr_8rem_auto] gap-2">
                  <input aria-label="Post title" placeholder="Post title as shown on the platform" value={post.title} onChange={(e) => patch(key, { posts: d.posts.map((p, k) => (k === i ? { ...p, title: e.target.value } : p)) })} className={input} maxLength={300} />
                  <input aria-label="Views" placeholder="Views" value={post.views} onChange={(e) => patch(key, { posts: d.posts.map((p, k) => (k === i ? { ...p, views: e.target.value } : p)) })} className={input} maxLength={60} />
                  <button type="button" aria-label="Remove post" onClick={() => patch(key, { posts: d.posts.filter((_, k) => k !== i) })} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-danger hover:bg-brand-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => patch(key, { posts: [...d.posts, { title: "", views: "" }] })} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-brand-50"><Plus className="h-4 w-4" />Add post</button>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">Audience (optional)</h3>
              <RowEditor rows={d.audience} onChange={(audience) => patch(key, { audience })} labelPlaceholder="Audience metric" valuePlaceholder="Result shown" addText="Add audience metric" />
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">Screenshots</h3>
              <p className="text-xs text-muted">JPG, PNG or WebP, up to 5 MB each. They appear in the PDF as analytics evidence.</p>
              {d.shots.map((shot) => (
                <div key={shot.key} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  {shot.url
                    ? <Image src={shot.url} alt={`${label} screenshot`} width={160} height={96} unoptimized className="h-14 w-24 rounded-lg border border-line object-cover" />
                    : <input type="file" name={`${key}_file_${shot.key}`} accept="image/jpeg,image/png,image/webp" aria-label="Screenshot file" className="text-sm file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:text-xs file:font-semibold file:text-brand-700" />}
                  <input aria-label="Caption" placeholder="Caption (optional)" value={shot.caption} onChange={(e) => patch(key, { shots: d.shots.map((s) => (s.key === shot.key ? { ...s, caption: e.target.value } : s)) })} className={input} maxLength={200} />
                  <button type="button" aria-label="Remove screenshot" onClick={() => patch(key, { shots: d.shots.filter((s) => s.key !== shot.key) })} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-danger hover:bg-brand-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {d.shots.length < 12 && <button type="button" onClick={() => patch(key, { shots: [...d.shots, { key: nextKey(), url: "", caption: "" }] })} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-brand-50"><Plus className="h-4 w-4" />Add screenshot</button>}
            </section>
          </div>
        );
      })}

      <section className="space-y-3">
        <h3 className="font-semibold">Meta ads performance &amp; summary</h3>
        <input type="hidden" name="meta_data" value={JSON.stringify({ shots: metaShots })} />
        <Field label="Summary (one line)" name="metaSummary" defaultValue={values.metaSummary} maxLength={300} placeholder="For example: Meta ads reached 42,000 people for Rs. 15,000 this month." />
        <h4 className="text-sm font-medium">Screenshots</h4>
        <p className="text-xs text-muted">JPG, PNG or WebP, up to 5 MB each. They appear in the PDF as analytics evidence.</p>
        {metaShots.map((shot) => (
          <div key={shot.key} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
            {shot.url
              ? <Image src={shot.url} alt="Meta ads screenshot" width={160} height={96} unoptimized className="h-14 w-24 rounded-lg border border-line object-cover" />
              : <input type="file" name={`meta_file_${shot.key}`} accept="image/jpeg,image/png,image/webp" aria-label="Screenshot file" className="text-sm file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:text-xs file:font-semibold file:text-brand-700" />}
            <input aria-label="Caption" placeholder="Caption (optional)" value={shot.caption} onChange={(e) => setMetaShots(metaShots.map((s) => (s.key === shot.key ? { ...s, caption: e.target.value } : s)))} className={input} maxLength={200} />
            <button type="button" aria-label="Remove screenshot" onClick={() => setMetaShots(metaShots.filter((s) => s.key !== shot.key))} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-danger hover:bg-brand-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {metaShots.length < 12 && <button type="button" onClick={() => setMetaShots([...metaShots, { key: nextKey(), url: "", caption: "" }])} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-brand-50"><Plus className="h-4 w-4" />Add screenshot</button>}
      </section>

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
        <TextareaField label="Overall completion summary" required name="clientSummary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} />
        <button type="button" onClick={() => setSummary(draftSummary(clientName, data))} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-brand-50"><Sparkles className="h-4 w-4" />Draft summary from the numbers</button>
      </section>
    </ActionForm>
  );
}
