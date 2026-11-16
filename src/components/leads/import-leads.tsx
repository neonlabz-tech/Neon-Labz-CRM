"use client";

import { Download, FileUp, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { iconButton } from "@/components/ui/icon-link";
import { cn } from "@/lib/utils";
import { importLeadsAction, previewLeadsAction } from "@/server/lead-actions";

type Props = {
  today: string;
  sources: string[];
  services: string[];
  stages: string[];
  sellers: { username: string; label: string }[];
};

type Preview = { count: number; problems: string[]; error?: string };

const HEADERS = ["Business", "Phone", "Date", "Source", "Service", "Status", "Email", "Address", "Next follow-up", "Notes", "Business type", "Owner"];

const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Import window: pick a CSV, see how many leads it holds, choose who gets them, then import. A template with example rows can be downloaded. */
export function ImportLeads({ today, sources, services, stages, sellers }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [owner, setOwner] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [checking, startCheck] = useTransition();
  const [importing, startImport] = useTransition();

  const body = (picked: File, who: string) => {
    const data = new FormData();
    data.set("file", picked);
    data.set("owner", who);
    return data;
  };

  const check = (picked: File | null, who: string) => {
    setPreview(null);
    if (!picked) return;
    startCheck(async () => setPreview(await previewLeadsAction(body(picked, who))));
  };

  const reset = () => { setFile(null); setPreview(null); setOwner(""); setResult(null); };

  const download = () => {
    const sample = [
      ["Sample Cafe (delete this row)", "077 123 4567", today, sources[0] ?? "", services[1] ?? "", stages[0] ?? "", "info@samplecafe.lk", "12 Main Street, Colombo 03", today, "Asked for a call back next week", "Restaurant", ""],
      ["Sample Hotel (delete this row)", "071 234 5678", today, sources[1] ?? "", services[0] ?? "", stages[2] ?? "", "", "45 Beach Road, Galle", "", "", "Hotel", sellers[0]?.username ?? ""],
    ];
    const csv = [HEADERS, ...sample].map((row) => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const count = preview?.count ?? 0;
  const busy = checking || importing;

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={cn(iconButton, "h-11 w-auto gap-2 rounded-xl px-5 text-sm font-semibold")}>
        <FileUp />Import CSV
      </button>
      <DialogShell
        dialogRef={dialog}
        title="Import leads from CSV"
        subtitle="Leads are saved to the database."
        icon={<FileUp className="h-5 w-5" />}
        onLeave={() => { dialog.current?.close(); reset(); }}
        closeButton
        className="h-fit w-[min(36rem,calc(100vw-1rem))]"
        footerExtra={
          <Button
            disabled={busy || count === 0}
            onClick={() => {
              if (!file) return;
              setResult(null);
              startImport(async () => {
                const outcome = await importLeadsAction(body(file, owner));
                setResult(outcome);
                if (outcome.ok) { setFile(null); setPreview(null); }
              });
            }}
          >
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}Import {count} lead{count === 1 ? "" : "s"}
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">Upload your leads sheet (File &gt; Download &gt; CSV in Google Sheets). Only <b>Business</b> is required; the other columns are optional.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                event.target.value = "";
                setResult(null);
                setFile(picked);
                check(picked, owner);
              }}
            />
            <Button disabled={busy} onClick={() => input.current?.click()}><FileUp className="h-4 w-4" />Choose CSV file</Button>
            <Button variant="outline" onClick={download}><Download className="h-4 w-4" />Download template</Button>
          </div>
          {file && <p className="text-sm font-medium">{file.name}</p>}
          {checking && <p role="status" className="text-xs text-muted">Checking the file…</p>}
          {preview?.error && <p role="alert" className="text-xs font-medium text-danger">{preview.error}</p>}
          {preview && !preview.error && (
            <div role="status" className="rounded-xl bg-brand-50/60 p-3 text-sm">
              <p className="font-semibold">{preview.count} lead{preview.count === 1 ? "" : "s"} ready to import{preview.problems.length ? `, ${preview.problems.length} skipped` : ""}.</p>
              {preview.problems.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
                  {preview.problems.slice(0, 5).map((problem) => <li key={problem}>{problem}</li>)}
                  {preview.problems.length > 5 && <li>and {preview.problems.length - 5} more</li>}
                </ul>
              )}
            </div>
          )}
          <label className="block text-sm font-semibold">
            Assign imported leads to
            <select
              value={owner}
              disabled={busy}
              onChange={(event) => { setOwner(event.target.value); check(file, event.target.value); }}
              className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal"
            >
              <option value="">Me (own leads)</option>
              {sellers.map((seller) => <option key={seller.username} value={seller.username}>{seller.label === seller.username ? seller.username : `${seller.label} · ${seller.username}`}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">Used when the file has no Owner column, or a row leaves it empty.</span>
          </label>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-semibold">Allowed values</summary>
            <p className="mt-1"><b>Source:</b> {sources.join(", ")}.</p>
            <p><b>Service:</b> {services.join(", ")}.</p>
            <p><b>Status:</b> {stages.join(", ")}.</p>
            <p><b>Date:</b> 2026-11-12 or 12/11/2026. <b>Owner:</b> a salesperson&apos;s login such as SD_001.</p>
          </details>
          {result && <p role="status" className={cn("text-xs font-medium", result.ok ? "text-success" : "text-danger")}>{result.message}</p>}
        </div>
      </DialogShell>
    </>
  );
}
