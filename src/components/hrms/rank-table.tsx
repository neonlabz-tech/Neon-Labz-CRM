"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { tableStyles } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

export type RankItem = { code: string; title: string; project: string; projectCode: string; status: string; statusLabel: string; tone: "success" | "info" | "warning" | "brand"; dueDate: string; late: boolean };
export type RankRow = { rank: number | null; score: number | null; username: string; name: string; team: "software" | "marketing" | "sales"; assigned: number; overdue: number; completed: number; converted: number; leave: number; nonApproved: number; items: RankItem[] };

const TEAM_LABEL = { software: "Software", marketing: "Marketing", sales: "Sales" } as const;
const TEAM_TONE = { software: "brand", marketing: "warning", sales: "success" } as const;

const METAL = [
  { name: "gold", from: "#fde68a", to: "#b7791f", ink: "#fffbeb", label: "1st" },
  { name: "silver", from: "#f1f5f9", to: "#64748b", ink: "#ffffff", label: "2nd" },
  { name: "bronze", from: "#f6c79b", to: "#9a4d12", ink: "#fff7ed", label: "3rd" },
] as const;

/** A round medal with a laurel wreath for the first three places; a plain number for the rest. */
function Medal({ place }: { place: number }) {
  const metal = METAL[place - 1];
  if (!metal) return <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{place}</span>;
  const angles = [-60, -40, -20, 0, 20, 40, 60];
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" role="img" aria-label={`${metal.label} place`}>
      <defs>
        <linearGradient id={`medal-${metal.name}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={metal.from} />
          <stop offset="1" stopColor={metal.to} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill={`url(#medal-${metal.name})`} />
      <circle cx="24" cy="24" r="20" fill="#1c2142" opacity="0.88" />
      {[1, -1].map((side) => angles.map((deg) => {
        const r = (deg * Math.PI) / 180;
        const x = 24 + side * 15 * Math.cos(r);
        const y = 24 - 15 * Math.sin(r);
        return <ellipse key={`${side}-${deg}`} cx={x} cy={y} rx="1.3" ry="2.8" fill={metal.from} transform={`rotate(${-side * deg} ${x} ${y})`} />;
      }))}
      <text x="24" y="28.5" textAnchor="middle" fontSize="15" fontWeight="800" fill={`url(#medal-${metal.name})`}>{place}</text>
      <text x="24" y="35" textAnchor="middle" fontSize="5" fontWeight="700" fill={metal.ink}>{metal.label.slice(1)}</text>
    </svg>
  );
}
// Tighter than the shared table so all the columns fit without scrolling.
const TH = "sticky top-0 z-10 whitespace-nowrap bg-canvas px-3 py-3";
const TD = "whitespace-nowrap px-3 py-3 align-middle text-ink/90";
const HEADERS = ["Rank", "Emp ID", "Employee", "Team", "Assigned", "Overdue", "Finished", "Converted", "Leave", "Non-approved", "Score", ""];

/** The productivity table, best first. The arrow (or the name) opens that person's tasks under their row. */
export function RankTable({ rows }: { rows: RankRow[] }) {
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (id: string) => setOpen((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));
  return (
    <div className={tableStyles.shell}>
      <table className={tableStyles.table}>
        <thead className={tableStyles.head}>
          <tr>{HEADERS.map((h, i) => <th key={i} className={cn(TH, i === 0 && "pl-6", i >= 3 && i <= 10 && "text-center", i === HEADERS.length - 1 && "pr-6")}>{h}</th>)}</tr>
        </thead>
        <tbody className={tableStyles.body}>
          {rows.map((r) => {
            const shown = open.includes(r.username);
            const sales = r.team === "sales";
            return [
              <tr key={r.username} className={tableStyles.row}>
                <td className={cn(TD, "pl-6")}>{r.rank ? <Medal place={r.rank} /> : <span className="text-xs text-muted" title="No score in this period: no task assigned, or no Sales target set">Not ranked</span>}</td>
                <td className={TD}>{r.username}</td>
                <td className={TD}>
                  <button type="button" onClick={() => toggle(r.username)} className="font-semibold text-brand-700 hover:underline" aria-expanded={shown}>{r.name}</button>
                </td>
                <td className={cn(TD, "text-center")}><Badge tone={TEAM_TONE[r.team]}>{TEAM_LABEL[r.team]}</Badge></td>
                <td className={cn(TD, "text-center")}>{sales ? "–" : r.assigned}</td>
                <td className={cn(TD, "text-center")}>{sales ? "–" : r.overdue ? <Badge tone="danger">{r.overdue}</Badge> : 0}</td>
                <td className={cn(TD, "text-center font-bold")}>{sales ? "–" : r.completed}</td>
                <td className={cn(TD, "text-center font-bold")}>{sales ? r.converted : "–"}</td>
                <td className={cn(TD, "text-center")}>{r.leave}</td>
                <td className={cn(TD, "text-center")}>{r.nonApproved ? <Badge tone="danger">{r.nonApproved}</Badge> : 0}</td>
                <td className={cn(TD, "text-center font-bold")}>{r.score === null ? "–" : r.score}</td>
                <td className={cn(TD, "pr-6")}>
                  <button type="button" onClick={() => toggle(r.username)} aria-label={`${shown ? "Hide" : "Show"} tasks of ${r.name}`} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-brand-50">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", shown && "rotate-180")} aria-hidden="true" />
                  </button>
                </td>
              </tr>,
              shown && (
                <tr key={`${r.username}-tasks`} className="bg-brand-50/30">
                  <td colSpan={HEADERS.length} className="px-6 py-4">
                    {r.items.length === 0 ? <p className="text-sm text-muted">{sales ? "No clients converted in this period." : "No tasks in this period."}</p> : (
                      <ul className="grid gap-2">
                        {r.items.map((t) => (
                          <li key={t.code} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="min-w-0">
                              <span className="font-medium text-ink">{t.title}</span>
                              {t.project && <span className="text-muted"> · {t.projectCode ? <Link prefetch={false} className="hover:underline" href={`/projects/${t.projectCode}`}>{t.project}</Link> : t.project}</span>}
                            </span>
                            <span className="flex items-center gap-2">
                              {t.dueDate && <span className={cn("text-xs", t.late ? "font-semibold text-danger" : "text-muted")}>Due {t.dueDate}</span>}
                              {t.late && <Badge tone="danger">Overdue</Badge>}
                              <Badge tone={t.tone}>{t.statusLabel}</Badge>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
