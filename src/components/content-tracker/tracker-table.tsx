"use client";

import { Pencil, Settings2, Smile, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { tableStyles } from "@/components/ui/data-table";
import { APPROVAL_STATUS, EMOJIS, NEW_TYPE, PUBLISH_STATUS, type TrackField } from "@/lib/content-tracker";
import type { TrackRow } from "@/lib/content-tracker-data";
import { cn } from "@/lib/utils";
import { addContentTypeAction, deleteContentTypeAction, renameContentTypeAction, saveContentFieldAction } from "@/server/content-tracker-actions";

type Assignee = { username: string; name: string };
type TypeItem = { id: string; name: string; count: number };
type TypeChange = { seq: number; from: string; to: string };
type Values = Pick<TrackRow, "contentType" | "assignee" | "caption" | "approval" | "scheduleDate" | "publishStatus">;

const control = "h-9 w-full rounded-lg border border-line bg-white px-2 text-xs text-ink hover:border-brand-300";
const statusTone = (value: string) => (value === "Approved" ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-700" : "border-amber-300 bg-amber-50 font-semibold text-amber-700");

/** One row. Every change is saved on its own as soon as it is made, and put back if the save fails. */
function TrackerRow({ row, projectCode, assignees, types, onNewType, change }: { row: TrackRow; projectCode: string; assignees: Assignee[]; types: string[]; onNewType: (name: string, id: string) => void; change: TypeChange }) {
  const [values, setValues] = useState<Values>({ contentType: row.contentType, assignee: row.assignee, caption: row.caption, approval: row.approval, scheduleDate: row.scheduleDate, publishStatus: row.publishStatus });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("");
  const [emojis, setEmojis] = useState(false);
  const saved = useRef(row.caption);
  // When a content type is renamed or deleted in the manage panel, rows showing it follow right away.
  useEffect(() => {
    if (change.seq && change.from) setValues((v) => (v.contentType === change.from ? { ...v, contentType: change.to } : v));
  }, [change]);
  const area = useRef<HTMLTextAreaElement>(null);

  async function save(field: TrackField, value: string) {
    const before = values[field];
    setValues((v) => ({ ...v, [field]: value }));
    setError("");
    setBusy(true);
    const result = await saveContentFieldAction({ projectCode, planId: row.planId, slot: row.slot, field, value }).catch(() => ({ ok: false, message: "Could not save. Check your connection." }));
    setBusy(false);
    if (!result.ok) {
      setValues((v) => ({ ...v, [field]: before }));
      setError(result.message);
      if (field === "caption") saved.current = before;
    } else if (field === "caption") saved.current = value;
  }

  async function addType() {
    setBusy(true);
    setError("");
    const result = await addContentTypeAction(newType).catch(() => ({ ok: false, message: "Could not add the type." }));
    setBusy(false);
    if (!result.ok) return setError(result.message);
    const chosen = (result as { name?: string }).name ?? result.message;
    onNewType(chosen, (result as { id?: string }).id ?? "");
    setAdding(false);
    setNewType("");
    await save("contentType", chosen);
  }

  function insertEmoji(emoji: string) {
    const box = area.current;
    const start = box?.selectionStart ?? values.caption.length;
    const end = box?.selectionEnd ?? values.caption.length;
    const next = values.caption.slice(0, start) + emoji + values.caption.slice(end);
    setValues((v) => ({ ...v, caption: next }));
    requestAnimationFrame(() => { box?.focus(); box?.setSelectionRange(start + emoji.length, start + emoji.length); });
  }

  const typeOptions = values.contentType && !types.includes(values.contentType) ? [...types, values.contentType] : types;

  return (
    <tr className={cn(tableStyles.row, busy && "opacity-80")}>
      <td className={cn(tableStyles.td, "font-semibold")}>{row.contentId}</td>
      <td className={tableStyles.td}>{row.publishDate || "—"}</td>
      <td className={tableStyles.td}>{row.time || "—"}</td>
      <td className={cn(tableStyles.td, "min-w-44")}>
        {adding ? (
          <div className="flex gap-1">
            <input autoFocus value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addType(); } if (e.key === "Escape") setAdding(false); }} placeholder="New type" maxLength={40} aria-label="New content type" className={control} />
            <button type="button" onClick={() => void addType()} disabled={busy || newType.trim().length < 2} className="h-9 rounded-lg bg-[#873CFF] px-3 text-xs font-semibold text-white disabled:opacity-50">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="h-9 rounded-lg border border-line px-2 text-xs">✕</button>
          </div>
        ) : (
          <select aria-label="Content type" value={values.contentType} onChange={(e) => (e.target.value === NEW_TYPE ? setAdding(true) : void save("contentType", e.target.value))} className={control}>
            <option value="">Select type</option>
            {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value={NEW_TYPE}>+ Add new type…</option>
          </select>
        )}
      </td>
      <td className={cn(tableStyles.td, "min-w-48 max-w-64 whitespace-normal")}>{row.topic || "—"}</td>
      <td className={tableStyles.td}>{row.postType || "—"}</td>
      <td className={cn(tableStyles.td, "min-w-44")}>
        <select aria-label="Assignee" value={values.assignee} onChange={(e) => void save("assignee", e.target.value)} className={control}>
          <option value="">Unassigned</option>
          {assignees.map((a) => <option key={a.username} value={a.username}>{a.name} ({a.username})</option>)}
          {values.assignee && !assignees.some((a) => a.username === values.assignee) && <option value={values.assignee}>{values.assignee}</option>}
        </select>
      </td>
      <td className={cn(tableStyles.td, "relative min-w-64 whitespace-normal")}>
        <div className="flex items-start gap-1">
          <textarea ref={area} aria-label="Caption" rows={2} maxLength={2200} value={values.caption} placeholder="Type the caption… emojis are welcome 😊" onChange={(e) => setValues((v) => ({ ...v, caption: e.target.value }))} onBlur={() => { if (values.caption !== saved.current) void save("caption", values.caption); }} className="w-full resize-y rounded-lg border border-line bg-white px-2 py-1.5 text-xs hover:border-brand-300" />
          <button type="button" aria-label="Add an emoji" title="Add an emoji" onMouseDown={(e) => e.preventDefault()} onClick={() => setEmojis((o) => !o)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:bg-brand-50"><Smile className="h-4 w-4" /></button>
        </div>
        {emojis && (
          <div onMouseDown={(e) => e.preventDefault()} className="absolute right-3 top-full z-20 mt-1 grid w-56 grid-cols-6 gap-1 rounded-xl border border-line bg-white p-2 shadow-lg">
            {EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="h-8 rounded-md text-base hover:bg-brand-50">{emoji}</button>)}
          </div>
        )}
      </td>
      <td className={cn(tableStyles.td, "min-w-32")}>
        <select aria-label="Approval status" value={values.approval} onChange={(e) => void save("approval", e.target.value)} className={cn(control, statusTone(values.approval))}>
          {APPROVAL_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className={cn(tableStyles.td, "min-w-36")}>
        <input type="date" aria-label="Schedule date" value={values.scheduleDate} onChange={(e) => void save("scheduleDate", e.target.value)} className={control} />
      </td>
      <td className={cn(tableStyles.td, "min-w-32")}>
        <select aria-label="Publish status" value={values.publishStatus} onChange={(e) => void save("publishStatus", e.target.value)} className={cn(control, statusTone(values.publishStatus))}>
          {PUBLISH_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {error && <p role="alert" className="mt-1 max-w-40 whitespace-normal text-[11px] font-medium text-danger">{error}</p>}
      </td>
    </tr>
  );
}


/** One content type in the manage panel: rename it or delete it. */
function TypeLine({ item, onDone }: { item: TypeItem; onDone: (next: { id: string; name?: string }) => void }) {
  const [name, setName] = useState(item.name);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function rename() {
    if (name.trim() === item.name) return setEditing(false);
    setBusy(true); setError("");
    const result = await renameContentTypeAction(item.id, name).catch(() => ({ ok: false, message: "Could not save." }));
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setEditing(false);
    onDone({ id: item.id, name: name.replace(/\s+/g, " ").trim() });
  }
  async function remove() {
    setBusy(true); setError("");
    const result = await deleteContentTypeAction(item.id).catch(() => ({ ok: false, message: "Could not delete." }));
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone({ id: item.id });
  }

  return (
    <li className="rounded-xl border border-line p-2">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <input autoFocus value={name} maxLength={40} aria-label={`Rename ${item.name}`} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void rename(); } if (e.key === "Escape") { setName(item.name); setEditing(false); } }} className={cn(control, "max-w-56")} />
            <button type="button" disabled={busy} onClick={() => void rename()} className="h-9 rounded-lg bg-[#873CFF] px-3 text-xs font-semibold text-white disabled:opacity-50">Save</button>
            <button type="button" onClick={() => { setName(item.name); setEditing(false); setError(""); }} className="h-9 rounded-lg border border-line px-3 text-xs">Cancel</button>
          </>
        ) : confirm ? (
          <>
            <span className="text-xs">Delete <strong>{item.name}</strong>?{item.count ? ` It will be cleared from ${item.count} row${item.count === 1 ? "" : "s"}.` : ""}</span>
            <button type="button" disabled={busy} onClick={() => void remove()} className="h-9 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-50">Yes, delete</button>
            <button type="button" onClick={() => setConfirm(false)} className="h-9 rounded-lg border border-line px-3 text-xs">Keep</button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-sm font-medium">{item.name}<span className="ml-2 text-xs font-normal text-muted">{item.count ? `used on ${item.count}` : "not used"}</span></span>
            <button type="button" aria-label={`Rename ${item.name}`} title="Rename" onClick={() => setEditing(true)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-brand-50"><Pencil className="h-4 w-4" /></button>
            <button type="button" aria-label={`Delete ${item.name}`} title="Delete" onClick={() => setConfirm(true)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </li>
  );
}

const HEADERS = ["Content ID", "Publish Date", "Time", "Content Type", "Topic", "Type", "Assignee", "Caption", "Approval Status", "Schedule Date", "Publish Status"];

/** The Content Tracker for one project. */
export function TrackerTable({ projectCode, rows, assignees, types }: { projectCode: string; rows: TrackRow[]; assignees: Assignee[]; types: TypeItem[] }) {
  const router = useRouter();
  const [list, setList] = useState(types);
  const [manage, setManage] = useState(false);
  useEffect(() => setList(types), [types]);
  const names = list.map((t) => t.name);
  const [change, setChange] = useState<TypeChange>({ seq: 0, from: "", to: "" });
  const addOption = (name: string, id: string) => setList((items) => (items.some((t) => t.name.toLowerCase() === name.toLowerCase()) ? items : [...items, { id, name, count: 0 }]));
  const changed = ({ id, name }: { id: string; name?: string }) => {
    const old = list.find((t) => t.id === id)?.name ?? "";
    setChange((c) => ({ seq: c.seq + 1, from: old, to: name ?? "" }));
    setList((items) => (name ? items.map((t) => (t.id === id ? { ...t, name } : t)) : items.filter((t) => t.id !== id)));
    router.refresh();
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setManage((o) => !o)} aria-expanded={manage} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-brand-50"><Settings2 className="h-4 w-4" />Manage content types</button>
      </div>
      {manage && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-2 text-xs text-muted">Rename or delete a content type. These are shared by every project. New types are added from the Content Type dropdown in the table.</p>
          <ul className="grid gap-2 md:grid-cols-2">
            {list.filter((t) => t.id).map((t) => <TypeLine key={`${t.id}:${t.name}`} item={t} onDone={changed} />)}
          </ul>
        </div>
      )}
      <div className={cn(tableStyles.shell, "overflow-visible")}>
        <div className="overflow-x-auto rounded-2xl">
          <table className={cn(tableStyles.table, "min-w-[1400px]")}>
            <thead className={tableStyles.head}>
              <tr>{HEADERS.map((h) => <th key={h} className={tableStyles.th}>{h}</th>)}</tr>
            </thead>
            <tbody className={tableStyles.body}>
              {rows.map((row) => <TrackerRow key={row.key} row={row} projectCode={projectCode} assignees={assignees} types={names} onNewType={addOption} change={change} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
