"use client";

import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { RichText } from "@/components/ui/rich-text";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Field } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { formatMoney, quoteFigures } from "@/lib/money";
import { richToLines } from "@/lib/rich-text";
import { saveQuotationAction } from "@/server/quotation-actions";
import { useToast } from "@/components/ui/toast";

type PackageOption = { id: string; name: string; price: number; scope: string; fullScope: string; hasSummary: boolean; icon: string };
type Line = { packageId: string; customName: string; price: string; scope: string; icon: string; selectedScopePoints: number[] };
type DefaultLine = Omit<Line, "selectedScopePoints">;
type Props = {
  leadId: string;
  packages: PackageOption[];
  defaults: { date: string; valid: string; discount: number; terms: string; lines: DefaultLine[] };
};

const blank: Line = { packageId: "", customName: "", price: "", scope: "", icon: "", selectedScopePoints: [] };

function scopePoints(html: string): string[] {
  const items = [...html.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)];
  return items.map(([item]) => richToLines(item)[0] ?? "").filter(Boolean);
}

function scopeForPdf(html: string, selected: number[]): string {
  const count = scopePoints(html).length;
  if (!count || selected.length === count || typeof DOMParser === "undefined") return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  [...document.body.querySelectorAll("li")].forEach((item, index) => {
    if (!selected.includes(index)) item.remove();
  });
  document.body.querySelectorAll("ul, ol").forEach((list) => {
    if (!list.querySelector("li")) list.remove();
  });
  return document.body.innerHTML;
}

export function QuoteForm({ leadId, packages, defaults }: Props) {
  const previewRef = useRef<HTMLDialogElement>(null);
  const previewButton = useRef<HTMLDivElement>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>(defaults.lines.length
    ? defaults.lines.map((line) => ({ ...line, selectedScopePoints: scopePoints(line.scope).map((_, index) => index) }))
    : [blank]);
  const [discount, setDiscount] = useState(String(defaults.discount));
  const [terms, setTerms] = useState(defaults.terms);

  const update = (index: number, patch: Partial<Line>) => setLines((list) => list.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  function choose(index: number, packageId: string) {
    const pkg = packages.find((p) => p.id === packageId);
    update(index, pkg
      ? { packageId, price: String(pkg.price), scope: pkg.scope, icon: pkg.icon, selectedScopePoints: scopePoints(pkg.scope).map((_, point) => point) }
      : { packageId, price: "", scope: "", icon: "", selectedScopePoints: [] });
  }
  const figures = quoteFigures(lines.reduce((sum, l) => sum + (Number(l.price) || 0), 0), Number(discount));
  const submittedLines = lines.map(({ selectedScopePoints, ...line }) => ({ ...line, scope: scopeForPdf(line.scope, selectedScopePoints) }));

  async function preview() {
    const form = previewButton.current?.closest("form");
    if (!form) return;
    setPreviewBusy(true);
    try {
      const response = await fetch("/api/pdf/quotation/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      if (!response.ok) {
        const result = await response.json() as { message?: string };
        throw new Error(result.message || "Could not open the quotation preview.");
      }
      setPreviewHtml(await response.text());
      previewRef.current?.showModal();
    } catch (error) {
      toast(false, error instanceof Error ? error.message : "Could not open the quotation preview.");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <ActionForm action={saveQuotationAction} submit="Save quotation" toastOnSuccess={false} className="space-y-6">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="lines" value={JSON.stringify(submittedLines)} />

      <div className="space-y-4">
        {lines.map((line, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-line bg-brand-50/40 p-4">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Package {index + 1}</label>
                <select value={line.packageId} onChange={(e) => choose(index, e.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" aria-label={`Package ${index + 1}`}>
                  <option value="">Choose a package</option>
                  {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="custom">Custom package</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Price (LKR)</label>
                <input value={line.price} onChange={(e) => update(index, { price: e.target.value })} type="number" min="0" step="0.01" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" aria-label={`Price ${index + 1}`} />
              </div>
              <Button variant="ghost" size="icon" onClick={() => setLines((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list))} aria-label={`Remove package ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
            {(() => {
              const pkg = packages.find((p) => p.id === line.packageId && p.hasSummary);
              if (!pkg) return null;
              const full = line.scope === pkg.fullScope;
              if (!full && line.scope !== pkg.scope) return null;
              return (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{full ? "Showing the full package details." : "Showing the short quote summary."}</span>
                  <button type="button" onClick={() => update(index, { scope: full ? pkg.scope : pkg.fullScope })} className="font-semibold text-brand-700 hover:underline">{full ? "Use quote summary" : "Use full details"}</button>
                </div>
              );
            })()}
            {line.packageId === "custom" && (
              <input value={line.customName} onChange={(e) => update(index, { customName: e.target.value })} placeholder="Title of the custom package" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" aria-label="Custom package title" />
            )}
            <RichText label="Scope" value={line.scope} onChange={(scope) => update(index, { scope, selectedScopePoints: scopePoints(scope).map((_, point) => point) })} placeholder="What the client gets" />
          </div>
        ))}
        <Button variant="secondary" onClick={() => setLines((list) => [...list, blank])}><Plus className="h-4 w-4" />Add another package</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quotation date" name="date" type="date" defaultValue={defaults.date} required />
        <Field label="Valid until" name="valid" type="date" defaultValue={defaults.valid} />
      </div>
      <section className="space-y-4 rounded-2xl border border-line bg-brand-50/40 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem] sm:items-end">
          <div>
            <h3 className="text-sm font-bold text-ink">Offer and payment terms</h3>
            <p className="mt-1 text-xs text-muted">The offer reduces the quotation total and appears in the PDF.</p>
          </div>
          <Field label="Offer / discount (%)" name="discount" type="number" min="0" max="100" step="0.1" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <RichText label="Payment terms" name="terms" value={terms} onChange={setTerms} placeholder="As agreed with the client." minHeight="7rem" />
      </section>

      <div ref={previewButton}>
        <Button type="button" variant="outline" disabled={previewBusy} onClick={preview}>
          {previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Preview PDF
        </Button>
      </div>

      <dl className="ml-auto w-full max-w-xs space-y-1.5 rounded-2xl bg-brand-50 p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Original price</dt><dd>{figures.discount ? <s>{formatMoney(figures.subtotal)}</s> : formatMoney(figures.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Offer ({figures.discountPercent}%)</dt><dd>− {formatMoney(figures.discount)}</dd></div>
        <div className="flex justify-between border-t border-line pt-1.5 text-base font-bold"><dt>Total</dt><dd>{formatMoney(figures.total)}</dd></div>
      </dl>
      <DialogShell
        dialogRef={previewRef}
        title="Quotation preview"
        icon={<FileText className="h-5 w-5" />}
        onLeave={() => previewRef.current?.close()}
        closeButton
        className="h-[92vh] w-[min(62rem,calc(100vw-1rem))]"
      >
        {previewHtml && <iframe title="Quotation PDF preview" srcDoc={previewHtml} className="h-[70vh] w-full rounded-xl border border-line bg-canvas max-sm:h-[62vh]" />}
      </DialogShell>
    </ActionForm>
  );
}
