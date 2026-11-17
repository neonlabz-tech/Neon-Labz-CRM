"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { RichText } from "@/components/ui/rich-text";
import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { formatMoney, quoteFigures } from "@/lib/money";
import { saveQuotationAction } from "@/server/quotation-actions";

type PackageOption = { id: string; name: string; price: number; scope: string; icon: string };
type Line = { packageId: string; customName: string; price: string; scope: string; icon: string };
type Props = {
  leadId: string;
  packages: PackageOption[];
  defaults: { date: string; valid: string; discount: number; terms: string; lines: Line[] };
};

const blank: Line = { packageId: "", customName: "", price: "", scope: "", icon: "" };

export function QuoteForm({ leadId, packages, defaults }: Props) {
  const [lines, setLines] = useState<Line[]>(defaults.lines.length ? defaults.lines : [blank]);
  const [discount, setDiscount] = useState(String(defaults.discount));

  const update = (index: number, patch: Partial<Line>) => setLines((list) => list.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  function choose(index: number, packageId: string) {
    const pkg = packages.find((p) => p.id === packageId);
    update(index, pkg ? { packageId, price: String(pkg.price), scope: pkg.scope, icon: pkg.icon } : { packageId, price: "", scope: "", icon: "" });
  }
  const figures = quoteFigures(lines.reduce((sum, l) => sum + (Number(l.price) || 0), 0), Number(discount));

  return (
    <ActionForm action={saveQuotationAction} submit="Save quotation" toastOnSuccess={false} className="space-y-6">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

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
            {line.packageId === "custom" && (
              <input value={line.customName} onChange={(e) => update(index, { customName: e.target.value })} placeholder="Title of the custom package" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" aria-label="Custom package title" />
            )}
            <RichText label="Scope" value={line.scope} onChange={(scope) => update(index, { scope })} placeholder="What the client gets" />
          </div>
        ))}
        <Button variant="secondary" onClick={() => setLines((list) => [...list, blank])}><Plus className="h-4 w-4" />Add another package</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Quotation date" name="date" type="date" defaultValue={defaults.date} required />
        <Field label="Valid until" name="valid" type="date" defaultValue={defaults.valid} />
        <Field label="Offer (%)" name="discount" type="number" min="0" max="100" step="0.1" value={discount} onChange={(e) => setDiscount(e.target.value)} />
      </div>
      <TextareaField label="Payment terms" name="terms" defaultValue={defaults.terms} placeholder="As agreed with the client." />

      <dl className="ml-auto w-full max-w-xs space-y-1.5 rounded-2xl bg-brand-50 p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(figures.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Offer ({figures.discountPercent}%)</dt><dd>− {formatMoney(figures.discount)}</dd></div>
        <div className="flex justify-between border-t border-line pt-1.5 text-base font-bold"><dt>Total</dt><dd>{formatMoney(figures.total)}</dd></div>
      </dl>
    </ActionForm>
  );
}
