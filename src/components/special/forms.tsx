"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { RichText } from "@/components/ui/rich-text";
import { formatMoney, quoteFigures } from "@/lib/money";
import { richToHtml } from "@/lib/rich-text";
import { saveSpecialClientAction, saveSpecialQuoteAction } from "@/server/special-actions";

export const SPECIAL_TYPE_OPTIONS = ["Influencer", "School", "Business", "Other"] as const;

export type ClientOption = { id: string; name: string; code: string };
export type ClientDefaults = { id?: string; name?: string; type?: string; contact?: string; phone?: string; email?: string; address?: string };

export function ClientForm({ defaults = {} }: { defaults?: ClientDefaults }) {
  return (
    <ActionForm action={saveSpecialClientAction} submit={defaults.id ? "Save client" : "Add client"} className="grid gap-4 sm:grid-cols-2">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <Field label="Client name" name="name" defaultValue={defaults.name} required />
      <SelectField label="Type" name="type" required defaultValue={defaults.type ?? "Influencer"}>
        {SPECIAL_TYPE_OPTIONS.map((type) => <option key={type}>{type}</option>)}
      </SelectField>
      <Field label="Contact person" name="contact" defaultValue={defaults.contact} />
      <Field label="Phone" name="phone" defaultValue={defaults.phone} />
      <Field label="Email" name="email" type="email" defaultValue={defaults.email} />
      <Field label="Address" name="address" defaultValue={defaults.address} />
    </ActionForm>
  );
}

type PackageOption = { id: string; name: string; price: number; scope: string; fullScope: string; hasSummary: boolean };
type Line = { name: string; price: string; scope: string };
export type QuoteDefaults = { id?: string; clientId?: string; date: string; valid: string; discount: number; terms: string; lines: Line[] };

export function QuoteForm({ clients, packages, defaults }: { clients: ClientOption[]; packages: PackageOption[]; defaults: QuoteDefaults }) {
  const [lines, setLines] = useState<Line[]>(defaults.lines.length ? defaults.lines : [{ name: "", price: "", scope: "" }]);
  const [discount, setDiscount] = useState(String(defaults.discount));
  const [terms, setTerms] = useState(defaults.terms ? richToHtml(defaults.terms) : "");
  const update = (index: number, patch: Partial<Line>) => setLines((list) => list.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const fill = (index: number, id: string) => {
    const pkg = packages.find((item) => item.id === id);
    if (pkg) update(index, { name: pkg.name, price: String(pkg.price), scope: pkg.scope });
  };
  const figures = quoteFigures(lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0), Number(discount));

  return (
    <ActionForm action={saveSpecialQuoteAction} submit={defaults.id ? "Save quotation" : "Create quotation"} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Client" name="clientId" required defaultValue={defaults.clientId ?? ""}>
          <option value="" disabled>Choose a client</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.code}</option>)}
        </SelectField>
        <Field label="Quotation date" name="date" type="date" defaultValue={defaults.date} required />
        <Field label="Valid until" name="valid" type="date" defaultValue={defaults.valid} />
      </div>

      <div className="space-y-4">
        {lines.map((line, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-line bg-brand-50/40 p-4">
            <label className="block text-sm font-medium">Item {index + 1}</label>
            {packages.length > 0 && (
              <select value="" onChange={(e) => fill(index, e.target.value)} className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-muted" aria-label={`Fill item ${index + 1} from a package`}>
                <option value="">Choose a package to fill this item (optional)</option>
                {packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
              </select>
            )}
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <input value={line.name} onChange={(e) => update(index, { name: e.target.value })} placeholder="Name of the service" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" aria-label={`Item ${index + 1} name`} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Price (LKR)</label>
                <input value={line.price} onChange={(e) => update(index, { price: e.target.value })} type="number" min="0" step="0.01" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" aria-label={`Item ${index + 1} price`} />
              </div>
              <Button variant="ghost" size="icon" onClick={() => setLines((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list))} aria-label={`Remove item ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
            {(() => {
              const pkg = packages.find((p) => p.name === line.name && p.hasSummary);
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
            <RichText label="What the client gets" value={line.scope} onChange={(scope) => update(index, { scope })} placeholder="Bullets or a table" />
          </div>
        ))}
        <Button variant="secondary" onClick={() => setLines((list) => [...list, { name: "", price: "", scope: "" }])}><Plus className="h-4 w-4" />Add another item</Button>
      </div>

      <section className="space-y-4 rounded-2xl border border-line bg-brand-50/40 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem] sm:items-end">
          <p className="text-xs text-muted">The offer reduces the total and appears in the PDF.</p>
          <Field label="Offer / discount (%)" name="discount" type="number" min="0" max="100" step="0.1" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <RichText label="Payment terms" name="terms" value={terms} onChange={setTerms} placeholder="As agreed with the client." minHeight="7rem" />
      </section>

      <dl className="ml-auto w-full max-w-xs space-y-1.5 rounded-2xl bg-brand-50 p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Original price</dt><dd>{figures.discount ? <s>{formatMoney(figures.subtotal)}</s> : formatMoney(figures.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Offer ({figures.discountPercent}%)</dt><dd>− {formatMoney(figures.discount)}</dd></div>
        <div className="flex justify-between border-t border-line pt-1.5 text-base font-bold"><dt>Total</dt><dd>{formatMoney(figures.total)}</dd></div>
      </dl>
    </ActionForm>
  );
}
