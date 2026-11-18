"use client";

import { Search } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? PACKAGE_ICONS.filter((icon) => icon.label.toLowerCase().includes(q) || icon.id.includes(q)) : PACKAGE_ICONS;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} placeholder={`Search ${PACKAGE_ICONS.length} icons (youtube, seo, video...)`} aria-label="Search icons" className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-[#873CFF]" />
      </div>
      <div className="max-h-52 overflow-y-auto rounded-xl border border-line p-2">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
          {!q && <button type="button" role="radio" aria-checked={!value} onClick={() => onChange("")} className={cn("h-10 rounded-xl border px-3 text-xs font-semibold", !value ? "brand-gradient border-transparent text-white" : "border-line bg-white text-muted hover:bg-brand-50")}>Auto</button>}
          {shown.map((icon) => (
            <button key={icon.id} type="button" role="radio" aria-checked={value === icon.id} aria-label={icon.label} title={icon.label} onClick={() => onChange(icon.id)} className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", value === icon.id ? "brand-gradient border-transparent text-white" : "border-line bg-white text-[#873CFF] hover:bg-brand-50")}>
              <PackageIconSvg id={icon.id} className="h-5 w-5" />
            </button>
          ))}
          {shown.length === 0 && <p className="p-2 text-sm text-muted">No icon matches &ldquo;{query}&rdquo;.</p>}
        </div>
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
