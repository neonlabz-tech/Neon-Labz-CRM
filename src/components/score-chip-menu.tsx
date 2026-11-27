"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScoreDetail = {
  score: number;
  rank: number;
  of: number;
  team: "software" | "marketing" | "sales";
  left: number;
  converted: number;
  leave: number;
  nonApproved: number;
  /** The score of 3rd place, so everyone else can see what top 3 takes. */
  thirdScore: number | null;
  days: number;
  penalty: number;
};

const PLACE = [
  { label: "1st", style: "border-amber-300 bg-amber-100 text-amber-800" },
  { label: "2nd", style: "border-slate-300 bg-slate-100 text-slate-700" },
  { label: "3rd", style: "border-orange-300 bg-orange-100 text-orange-800" },
];

function Line({ label, value, bad }: { label: string; value: React.ReactNode; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", bad ? "text-danger" : "text-ink")}>{value}</dd>
    </div>
  );
}

/** The chip beside the bell. Click it for how the score was worked out. */
export function ScoreChipMenu({ d }: { d: ScoreDetail }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const place = d.rank <= 3 ? PLACE[d.rank - 1] : null;
  const gap = d.thirdScore === null ? null : Math.max(0, d.thirdScore - d.score);
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Your score for the last ${d.days} days. Click for details.`}
        className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition hover:brightness-95", place ? place.style : "border-line bg-brand-50 text-brand-700")}
      >
        {place && <Trophy className="h-4 w-4" aria-hidden="true" />}
        {place ? `${place.label} · ${d.score}` : `Score ${d.score}`}
      </button>
      {open && (
        <div role="dialog" aria-label="Your score" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-white p-4 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your score · last {d.days} days</p>
          <p className="mt-1 text-3xl font-bold text-ink">{d.score}<span className="text-base font-semibold text-muted"> / 100</span></p>
          <p className="text-sm text-muted">{place ? `${place.label} place in the company` : `Rank ${d.rank} of ${d.of}`}</p>
          <dl className="mt-3 divide-y divide-line border-t border-line">
            {d.team === "sales" ? (
              <Line label="Clients converted" value={d.converted} />
            ) : (
              <Line label="Tasks left" value={d.left} />
            )}
            <Line label="Leave days" value={d.leave} />
            <Line label={`Non-approved leave (−${d.penalty} each)`} value={d.nonApproved} bad={d.nonApproved > 0} />
          </dl>
          <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">
            {place ? "You are in the top 3. Keep it up." : gap === null ? "Top 3 will show once more people have a score." : `Top 3 starts at ${d.thirdScore}. You need ${gap} more point${gap === 1 ? "" : "s"}.`}
          </p>
          <p className="mt-2 text-[11px] text-muted">Updated every 15 minutes.</p>
        </div>
      )}
    </div>
  );
}
