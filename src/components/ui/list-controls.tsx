import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AutoForm } from "@/components/ui/auto-form";
import { ALL_LIMIT, PAGE_SIZE } from "@/lib/pagination";

type Filter = { name: string; label: string; value: string; options: { value: string; label: string }[] };

export function SearchBar({ q, placeholder, filters = [], keep = {}, range }: { q: string; placeholder: string; filters?: Filter[]; keep?: Record<string, string>; range?: { from: string; to: string } }) {
  return (
    <AutoForm className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-[0_1px_3px_rgba(28,33,66,0.06)]">
      {Object.entries(keep).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className="relative min-w-0 flex-1 basis-56">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} placeholder={placeholder} aria-label="Search" className="h-11 w-full rounded-xl border border-transparent bg-canvas pl-10 pr-3 text-sm placeholder:text-muted/80 focus:border-brand-300 focus:bg-white" />
      </div>
      {filters.map((filter) => (
        <select key={filter.name} name={filter.name} defaultValue={filter.value} aria-label={filter.label} className="h-11 rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">{filter.label}</option>
          {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ))}
      {range && (
        <>
          <input type="date" name="from" defaultValue={range.from} aria-label="From date" className="h-11 rounded-xl border border-line bg-white px-3 text-sm" />
          <input type="date" name="to" defaultValue={range.to} aria-label="To date" className="h-11 rounded-xl border border-line bg-white px-3 text-sm" />
        </>
      )}
    </AutoForm>
  );
}

/** First, last and the pages around the current one, with gaps shown as dots. */
function pageList(page: number, pages: number): (number | "gap")[] {
  const wanted = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((x, y) => x - y);
  return wanted.flatMap((n, i) => (i > 0 && n - wanted[i - 1]! > 1 ? (["gap", n] as const) : [n]));
}

export function Pagination({ page, total, query }: { page: number; total: number; query: Record<string, string> }) {
  const all = page === 0;
  const pages = all ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (target: number) => {
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value));
    params.set("page", target === 0 ? "all" : String(target));
    return `?${params.toString()}`;
  };
  const from = total === 0 ? 0 : all ? 1 : (page - 1) * PAGE_SIZE + 1;
  const to = all ? Math.min(total, ALL_LIMIT) : Math.min(total, page * PAGE_SIZE);
  const base = "flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium";
  return (
    <nav className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-line bg-white px-6 py-3.5 text-sm text-muted shadow-[0_1px_3px_rgba(28,33,66,0.06)] sm:flex-row" aria-label="Pages">
      <span>{total === 0 ? "No results" : <>Showing {from} to {to} of {total} items</>}</span>
      {(pages > 1 || all) && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {all ? <Link prefetch={false} href={href(1)} className={`${base} border border-line text-ink hover:bg-brand-50`}>Show pages</Link> : <>
          {page > 1 ? <Link prefetch={false} href={href(page - 1)} aria-label="Previous page" className={`${base} border border-line text-ink hover:bg-brand-50`}><ChevronLeft className="h-4 w-4" /></Link> : <span className={`${base} border border-line opacity-40`}><ChevronLeft className="h-4 w-4" /></span>}
          {pageList(page, pages).map((n, i) => n === "gap"
            ? <span key={`gap-${i}`} className="px-1">…</span>
            : n === page
              ? <span key={n} aria-current="page" className={`${base} brand-gradient text-white shadow-sm`}>{n}</span>
              : <Link prefetch={false} key={n} href={href(n)} className={`${base} text-ink hover:bg-brand-50`}>{n}</Link>)}
          {page < pages ? <Link prefetch={false} href={href(page + 1)} aria-label="Next page" className={`${base} border border-line text-ink hover:bg-brand-50`}><ChevronRight className="h-4 w-4" /></Link> : <span className={`${base} border border-line opacity-40`}><ChevronRight className="h-4 w-4" /></span>}
          <Link prefetch={false} href={href(0)} className={`${base} border border-line text-ink hover:bg-brand-50`}>All</Link>
          </>}
        </div>
      )}
    </nav>
  );
}
