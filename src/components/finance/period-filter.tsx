import { Search } from "lucide-react";
import { AutoForm, ClearFilters } from "@/components/ui/auto-form";
import { MONTHS } from "@/lib/finance";

type Extra = { name: string; label: string; value: string; options: { value: string; label: string }[] };
const select = "h-11 rounded-xl border border-line bg-white px-3 text-sm";

/** Year and month default to the current period; the clear link shows everything. */
export function PeriodFilter({ year, month, q, searchLabel, extras = [], basePath, keep = {}, range }: {
  range?: { from: string; to: string };
  year: string; month: string; q?: string; searchLabel?: string; extras?: Extra[]; basePath: string; keep?: Record<string, string>;
}) {
  const thisYear = Number(new Date().getFullYear());
  const years = Array.from({ length: 8 }, (_, i) => String(thisYear + 1 - i));
  if (year && !years.includes(year)) years.push(year);
  return (
    <AutoForm className="mb-4 flex flex-wrap gap-2">
      {Object.entries(keep).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {searchLabel && (
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder={searchLabel} aria-label="Search" className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-sm" />
        </div>
      )}
      <select name="year" defaultValue={year || "all"} aria-label="Year" className={select}>
        <option value="all">All years</option>
        {years.map((y) => <option key={y}>{y}</option>)}
      </select>
      <select name="month" defaultValue={month || "all"} aria-label="Month" className={select}>
        <option value="all">All months</option>
        {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
      </select>
      {extras.map((e) => (
        <select key={e.name} name={e.name} defaultValue={e.value} aria-label={e.label} className={select}>
          <option value="">{e.label}</option>
          {e.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {range && (
        <>
          <input type="date" name="from" defaultValue={range.from} aria-label="From date" title="From date" className={select} />
          <input type="date" name="to" defaultValue={range.to} aria-label="To date" title="To date" className={select} />
        </>
      )}
      <ClearFilters href={`${basePath}?${new URLSearchParams({ ...keep, year: "all" })}`} className="inline-flex h-11 cursor-pointer items-center rounded-xl px-4 text-sm font-semibold text-muted hover:text-ink">Show everything</ClearFilters>
    </AutoForm>
  );
}
