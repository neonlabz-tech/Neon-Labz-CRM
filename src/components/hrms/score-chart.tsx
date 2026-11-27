import { Card } from "@/components/ui/card";

export type ChartTeam = "software" | "marketing" | "sales";
const COLOR: Record<ChartTeam, string> = { software: "bg-brand-600", marketing: "bg-amber-500", sales: "bg-emerald-500" };
const LABEL: Record<ChartTeam, string> = { software: "Software", marketing: "Marketing", sales: "Sales" };

function Bar({ label, value, team, strong }: { label: string; value: number | null; team: ChartTeam; strong?: boolean }) {
  return (
    <li className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_3rem]">
      <span className={strong ? "truncate font-semibold text-ink" : "truncate text-ink/90"} title={label}>{label}</span>
      <span className="h-3 overflow-hidden rounded-full bg-brand-50" role="img" aria-label={`${label}: ${value ?? "no score"}`}>
        <span className={`block h-full rounded-full ${COLOR[team]}`} style={{ width: `${value ?? 0}%` }} />
      </span>
      <span className="text-right font-semibold tabular-nums text-ink">{value === null ? "–" : value}</span>
    </li>
  );
}

/** A bar for each team's average, then a bar for each ranked person, all on the same 0–100 score. */
export function ScoreChart({ averages, people }: { averages: { team: ChartTeam; value: number | null }[]; people: { name: string; team: ChartTeam; score: number }[] }) {
  return (
    <Card className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Score out of 100</h2>
        <span className="flex flex-wrap gap-3 text-xs text-muted">
          {(Object.keys(COLOR) as ChartTeam[]).map((t) => <span key={t} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${COLOR[t]}`} />{LABEL[t]}</span>)}
        </span>
      </div>
      {averages.length > 0 && (
        <ul className="grid gap-2 border-b border-line pb-3">
          {averages.map((a) => <Bar key={a.team} label={`${LABEL[a.team]} average`} value={a.value} team={a.team} strong />)}
        </ul>
      )}
      {people.length === 0 ? <p className="pt-3 text-sm text-muted">Nobody has a score in this period yet.</p> : (
        <ul className="mt-3 grid max-h-96 gap-2 overflow-y-auto pr-1">
          {people.map((p, i) => <Bar key={`${p.name}-${i}`} label={p.name} value={p.score} team={p.team} />)}
        </ul>
      )}
    </Card>
  );
}
