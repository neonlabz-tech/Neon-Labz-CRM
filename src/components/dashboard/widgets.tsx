import Link from "next/link";
import { Bookmark, Gem, Layers, Star, TrendingUp, Users } from "lucide-react";
import { Card, ColorCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Slice } from "./charts";

export type { Slice } from "./charts";
export { Bars, Gauge, MiniRing, Ring } from "./charts";

export const PALETTE = ["#7a2bf0", "#1c2142", "#c711fc", "#67adff", "#f103fa", "#131937", "#070c2b", "#9aa4c7"];

/** Turns grouped counts into chart slices in a fixed order, so a missing group still shows as zero. */
export function slices(catalog: readonly (readonly [string, string])[], counts: Record<string, number>): Slice[] {
  return catalog.map(([id, label], index) => ({ id, label, value: counts[id] ?? 0, color: PALETTE[index % PALETTE.length]! }));
}

/** Adds the names kept by `groupNamed` to the matching slices. */
export function withNames(data: Slice[], rows: { _id: unknown; names?: unknown[] }[]): Slice[] {
  const byId = new Map(rows.map((row) => [String(row._id), (row.names ?? []).map(String).filter(Boolean)]));
  return data.map((slice) => ({ ...slice, names: byId.get(slice.id) ?? [] }));
}

export function toCounts(rows: { _id: unknown; n: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [String(row._id), row.n]));
}

export function Hero({ kicker, title, note, badge, alert = false }: { kicker: string; title: string; note?: string; badge?: string; alert?: boolean }) {
  return (
    <header className="mb-5 flex flex-wrap bg-gradient-to-r from-[#44208f] to-[#6e46c9] items-center justify-between gap-3 rounded-2xl px-6 py-5 text-white">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/75">{kicker}</p>
        <h2 className="text-xl font-bold">{title}</h2>
        {note && <p className="text-sm text-white/80">{note}</p>}
      </div>
      {badge && <strong className={cn("rounded-full px-4 py-1.5 text-sm", alert ? "bg-white text-brand-700" : "bg-white/20")}>{badge}</strong>}
    </header>
  );
}

const KPI_ICONS = [TrendingUp, Bookmark, Gem, Users, Star, Layers] as const;

/** Coloured summary cards; each takes the next colour and icon in turn. */
export function Kpis({ items }: { items: { label: string; value: string | number; hint?: string }[] }) {
  return (
    <section className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
      {items.map((item, index) => {
        const Icon = KPI_ICONS[index % KPI_ICONS.length]!;
        return <ColorCard key={item.label} {...item} icon={<Icon className="h-4 w-4" />} tone={index} />;
      })}
    </section>
  );
}

export function ChartGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return <div className={cn("mb-5 grid gap-4 [&>*]:min-w-0", cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2 lg:[&>*:last-child:nth-child(odd)]:col-span-2")}>{children}</div>;
}

export function Progress({ value }: { value: number }) {
  return <div className="h-2.5 rounded-full bg-brand-50"><div className="brand-gradient h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

/** Two tabs that keep the chosen period in the address. */
export function Tabs({ items, current, base }: { items: { id: string; label: string }[]; current: string; base: URLSearchParams }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {items.map((item) => {
        const query = new URLSearchParams(base);
        query.set("board", item.id);
        return (
          <Link prefetch={false} key={item.id} href={`/dashboard?${query}`} role="tab" aria-selected={item.id === current} className={cn("rounded-xl px-4 py-2 text-sm font-semibold", item.id === current ? "bg-brand-600 text-white" : "bg-white text-ink ring-1 ring-line hover:bg-brand-50")}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Panel({ title, children, empty }: { title: string; children?: React.ReactNode; empty?: string }) {
  return (
    <Card className="mb-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children ?? <p className="text-sm text-muted">{empty}</p>}
    </Card>
  );
}
