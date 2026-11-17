"use client";

import { useState } from "react";
import { PACKAGE_ICONS, iconPaths } from "@/lib/package-icons";
import { cn } from "@/lib/utils";

/** One icon, drawn in the colour of the surrounding text. */
export function PackageIconSvg({ id, className }: { id: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconPaths(id) }} />;
}

type PickerProps = { value: string; onChange: (id: string) => void; label?: string; hint?: string };

/** A row of icons to choose from. Empty means "Auto": the icon is picked from the package name. */
export function IconPicker({ value, onChange, label = "Icon on the quotation", hint = "Auto picks an icon from the package name." }: PickerProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        <button type="button" role="radio" aria-checked={!value} onClick={() => onChange("")} className={cn("h-10 rounded-xl border px-3 text-xs font-semibold", !value ? "brand-gradient border-transparent text-white" : "border-line bg-white text-muted hover:bg-brand-50")}>Auto</button>
        {PACKAGE_ICONS.map((icon) => (
          <button key={icon.id} type="button" role="radio" aria-checked={value === icon.id} aria-label={icon.label} title={icon.label} onClick={() => onChange(icon.id)} className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", value === icon.id ? "brand-gradient border-transparent text-white" : "border-line bg-white text-[#873CFF] hover:bg-brand-50")}>
            <PackageIconSvg id={icon.id} className="h-5 w-5" />
          </button>
        ))}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** The picker for the package form: it keeps its own choice and sends it with the form as `icon`. */
export function IconField({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name="icon" value={value} />
      <IconPicker value={value} onChange={setValue} label="Icon" hint="Shown beside this package on every quotation. Auto picks one from the package name." />
    </>
  );
}
