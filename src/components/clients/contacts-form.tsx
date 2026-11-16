"use client";

import { ImagePlus, Plus, Trash2, Undo2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileField } from "@/components/ui/file-field";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { saveClientContactsAction } from "@/server/client-actions";

type Person = { name: string; title: string; email: string; phone: string };
export type ContactValues = { code: string; name: string; service: string; workType: string; contactName: string; contactTitle: string; assignedPerson: string; email: string; phone: string; address: string; notes: string; subContacts: Person[] };

const blank: Person = { name: "", title: "", email: "", phone: "" };

/** Shows the current logo with Change and Remove buttons; with no logo it shows the upload box. */
function LogoField({ logo, name }: { logo: string; name: string }) {
  const [mode, setMode] = useState<"keep" | "change" | "remove">("keep");
  const [broken, setBroken] = useState(false);
  const accept = "image/jpeg,image/png,image/webp";
  if (!logo) return <FileField label="Logo" name="logo" accept={accept} hint="JPG, PNG or WebP · up to 2 MB" maxMb={2} />;
  return (
    <div>
      <span className="mb-1 block text-sm font-medium">Logo</span>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
        {!broken && mode !== "remove" ? (
          <Image src={logo} alt={`${name} logo`} width={56} height={56} unoptimized onError={() => setBroken(true)} className="h-14 w-14 shrink-0 rounded-lg border border-line bg-white object-contain" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-brand-50 text-muted" aria-hidden><ImagePlus className="h-5 w-5" /></span>
        )}
        <div className="min-w-0 flex-1 text-sm">
          {mode === "remove" ? <p className="text-muted">The logo will be removed when you save.</p> : mode === "change" ? (
            <FileField label="New logo" name="logo" accept={accept} hint="JPG, PNG or WebP · up to 2 MB" maxMb={2} />
          ) : <p className="text-muted">Current logo</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {mode === "keep" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setMode("change")}>Change logo</Button>
              <Button variant="outline" size="sm" onClick={() => setMode("remove")}>Remove logo</Button>
            </>
          )}
          {mode !== "keep" && <Button variant="ghost" size="sm" onClick={() => setMode("keep")}><Undo2 className="h-4 w-4" />Keep current</Button>}
        </div>
      </div>
      {mode === "remove" && <input type="hidden" name="removeLogo" value="on" />}
    </div>
  );
}

export function ContactsForm({ values, canSetWork = false, logo = "" }: { values: ContactValues; canSetWork?: boolean; logo?: string }) {
  const [people, setPeople] = useState<Person[]>(values.subContacts);
  const update = (index: number, patch: Partial<Person>) => setPeople((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  return (
    <ActionForm action={saveClientContactsAction} submit="Save client" className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="code" value={values.code} />
      <input type="hidden" name="subContacts" value={JSON.stringify(people)} />
      <div className="sm:col-span-2">
        <LogoField logo={logo} name={values.name} />
      </div>
      <Field label="Client name" required name="name" defaultValue={values.name} maxLength={120} />
      <Field label="Service" name="service" defaultValue={values.service} maxLength={200} />
      {canSetWork && (
        <SelectField label="Work" name="workType" defaultValue={values.workType}>
          <option value="software">Software</option>
          <option value="marketing">Marketing</option>
          <option value="both">Software + marketing</option>
        </SelectField>
      )}
      <Field label="Main person" required name="contactName" defaultValue={values.contactName} maxLength={120} />
      <Field label="Main person title" name="contactTitle" defaultValue={values.contactTitle} maxLength={120} />
      <Field label="Assigned person" name="assignedPerson" defaultValue={values.assignedPerson} maxLength={120} />
      <Field label="Email" name="email" type="email" defaultValue={values.email} />
      <Field label="Contact number" name="phone" type="tel" inputMode="tel" placeholder="077-123-4567" defaultValue={values.phone} />
      <Field label="Address" name="address" defaultValue={values.address} maxLength={300} />
      <div className="sm:col-span-2"><TextareaField label="Notes" name="notes" defaultValue={values.notes} rows={2} maxLength={2000} /></div>
      <div className="space-y-3 sm:col-span-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Sub contacts</h3>
          <Button variant="outline" size="sm" onClick={() => setPeople((list) => [...list, { ...blank }])}><Plus className="h-4 w-4" />Add sub contact</Button>
        </div>
        {people.length === 0 && <p className="text-sm text-muted">No sub contacts yet.</p>}
        {people.map((p, index) => (
          <div key={index} className="grid gap-2 rounded-xl bg-brand-50/50 p-3 sm:grid-cols-2">
            <input value={p.name} onChange={(e) => update(index, { name: e.target.value })} placeholder="Name" aria-label={`Sub contact ${index + 1} name`} className="h-10 rounded-xl border border-line bg-white px-3 text-sm" />
            <input value={p.title} onChange={(e) => update(index, { title: e.target.value })} placeholder="Title" aria-label={`Sub contact ${index + 1} title`} className="h-10 rounded-xl border border-line bg-white px-3 text-sm" />
            <input value={p.email} onChange={(e) => update(index, { email: e.target.value })} placeholder="Email" type="email" aria-label={`Sub contact ${index + 1} email`} className="h-10 rounded-xl border border-line bg-white px-3 text-sm" />
            <div className="flex gap-2">
              <input value={p.phone} onChange={(e) => update(index, { phone: e.target.value })} placeholder="077-123-4567" type="tel" aria-label={`Sub contact ${index + 1} phone`} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm" />
              <Button variant="ghost" size="icon" onClick={() => setPeople((list) => list.filter((_, i) => i !== index))} aria-label={`Remove sub contact ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </ActionForm>
  );
}
