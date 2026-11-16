"use client";

import { useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

/** `names` lists the records behind a slice; when any slice has them, the chart shows them on selection. */
export type Slice = { id: string; label: string; value: number; color: string; names?: string[] };

const FORMATS = { count: (value: number) => String(value), money: formatMoney };

function Detail({ slice }: { slice: Slice }) {
  const names = slice.names ?? [];
  if (!names.length) return <p className="mt-4 text-sm text-muted">Nothing recorded under {slice.label}.</p>;
  return (
    <ul className="mt-4 space-y-1 rounded-xl bg-brand-50/60 p-3 text-sm" aria-live="polite">
      {names.slice(0, 4).map((name, index) => <li key={`${name}-${index}`} className="truncate">{name}</li>)}
      {slice.value > 4 && <li className="text-muted">+{slice.value - 4} more</li>}
    </ul>
  );
}

export function Ring({ title, data }: { title: string; data: Slice[] }) {
  const [picked, setPicked] = useState(() => data.find((item) => item.value > 0)?.id ?? data[0]?.id ?? "");
  const chosen = data.find((item) => item.id === picked) ?? data[0];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 52;
  const circle = 2 * Math.PI * radius;
  let used = 0;
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
        <svg viewBox="0 0 160 160" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={title}>
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#e6e8ee" strokeWidth="18" />
          {total > 0 && data.filter((item) => item.value > 0).map((item) => {
            const length = (item.value / total) * circle;
            const selected = item.id === chosen?.id;
            const part = (
              <circle
                key={item.id} cx="80" cy="80" r={radius} fill="none" stroke={item.color} strokeWidth={selected ? 24 : 18}
                strokeDasharray={`${length} ${circle - length}`} strokeDashoffset={-used}
                opacity={selected ? 1 : 0.6} className="cursor-pointer transition-all" onClick={() => setPicked(item.id)}
              />
            );
            used += length;
            return part;
          })}
        </svg>
        <ul className="w-full min-w-[11rem] flex-1 space-y-1 text-sm">
          {data.map((item) => (
            <li key={item.id}>
              <button
                type="button" onClick={() => setPicked(item.id)} aria-pressed={item.id === chosen?.id}
                className={cn("flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-brand-50", item.id === chosen?.id && "bg-brand-50 font-semibold")}
              >
                <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <strong className="shrink-0 whitespace-nowrap">{item.value}{total > 0 && item.value > 0 ? ` (${Math.round((item.value / total) * 100)}%)` : ""}</strong>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {chosen && data.some((item) => item.names) && <Detail slice={chosen} />}
    </Card>
  );
}

const COMPACT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Vertical columns: the height shows the amount, and picking one shows the records behind it. */
export function Bars({ title, data, format = "count", empty = "Nothing yet." }: { title: string; data: Slice[]; format?: keyof typeof FORMATS; empty?: string }) {
  const [picked, setPicked] = useState(data[0]?.id ?? "");
  const chosen = data.find((item) => item.id === picked) ?? data[0];
  const max = Math.max(1, ...data.map((item) => item.value));
  const show = FORMATS[format];
  const short = (value: number) => (format === "money" ? COMPACT.format(value) : String(value));
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {data.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
        <div className="overflow-x-auto pb-1">
          <ul className="flex items-end gap-2" style={{ minWidth: data.length * 56 }}>
            {data.map((item) => {
              const selected = item.id === chosen?.id;
              return (
                <li key={item.id} className="flex min-w-12 flex-1 flex-col">
                  <button
                    type="button" onClick={() => setPicked(item.id)} aria-pressed={selected} title={`${item.label}: ${show(item.value)}`}
                    className={cn("group flex h-44 w-full items-end rounded-xl px-1 pb-0 pt-6 hover:bg-brand-50 focus-visible:bg-brand-50", selected && "bg-brand-50")}
                  >
                    <span className="relative block w-full rounded-t-xl transition-all" style={{ height: `${item.value ? Math.max(4, (item.value / max) * 100) : 0}%`, background: item.color, opacity: selected ? 1 : 0.7 }}>
                      <strong className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{short(item.value)}</strong>
                    </span>
                  </button>
                  <span className="mt-1 truncate text-center text-xs text-muted">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {chosen && data.length > 0 && <p className="mt-3 text-sm text-muted"><strong className="text-ink">{chosen.label}</strong> · {show(chosen.value)}</p>}
      {chosen && data.some((item) => item.names) && <Detail slice={chosen} />}
    </Card>
  );
}

/** One percentage as a half-circle dial. `dark` is for dark cards. */
export function Gauge({ value, label, dark = false }: { value: number; label?: string; dark?: boolean }) {
  const id = useId().replace(/:/g, "");
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  const length = Math.PI * 80;
  return (
    <div className="mx-auto w-full max-w-[15rem] text-center">
      <svg viewBox="0 0 200 118" className="w-full" role="img" aria-label={`${percent}%${label ? ` ${label}` : ""}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#7a2bf0" /><stop offset="100%" stopColor="#c711fc" /></linearGradient>
        </defs>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={dark ? "rgba(255,255,255,0.12)" : "#ede0ff"} strokeWidth="16" strokeLinecap="round" />
        {percent > 0 && <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={`url(#${id})`} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(length * percent) / 100} ${length}`} />}
        <text x="100" y="88" textAnchor="middle" fontSize="34" fontWeight="700" fill={dark ? "#ffffff" : "#1c2142"}>{percent}%</text>
      </svg>
      {label && <p className={cn("-mt-1 text-sm", dark ? "text-white/70" : "text-muted")}>{label}</p>}
    </div>
  );
}

/** A small circle for a percentage inside a list row. */
export function MiniRing({ value, size = 44 }: { value: number; size?: number }) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  const radius = 16;
  const circle = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} className="shrink-0" role="img" aria-label={`${percent}%`}>
      <circle cx="22" cy="22" r={radius} fill="none" stroke="#ede0ff" strokeWidth="6" />
      {percent > 0 && <circle cx="22" cy="22" r={radius} fill="none" stroke="#7a2bf0" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(circle * percent) / 100} ${circle}`} transform="rotate(-90 22 22)" />}
      <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1c2142">{percent}</text>
    </svg>
  );
}
