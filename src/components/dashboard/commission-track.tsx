import Link from "next/link";
import { formatMoney } from "@/lib/money";

/** Commission rate, what has been earned, and what a fully achieved target would pay. */
export function CommissionTrack({ rate, collected, target, paid = 0 }: { rate: number; collected: number; target: number; paid?: number }) {
  const earned = (collected * rate) / 100;
  const full = (target * rate) / 100;
  const percent = full ? Math.min(100, Math.round((100 * earned) / full)) : 0;
  return (
    <section className="mb-5 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-fuchsia-50 p-5 shadow-sm sm:p-6" aria-label="Commission tracker">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Commission tracker</p>
        <Link prefetch={false} href="/my-targets" className="text-xs font-semibold text-brand-700 hover:underline">See milestones</Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div><dt className="text-xs text-muted">Commission rate</dt><dd className="text-2xl font-bold text-ink">{rate}%</dd></div>
        <div><dt className="text-xs text-muted">Earned commission</dt><dd className="text-2xl font-bold text-success">{formatMoney(earned)}</dd></div>
        <div><dt className="text-xs text-muted">Paid to you</dt><dd className="text-2xl font-bold text-ink">{formatMoney(paid)}</dd><dd className={`text-xs font-semibold ${earned > 0 && paid >= earned ? "text-success" : "text-amber-600"}`}>{earned <= 0 ? "" : paid >= earned ? "Fully paid" : paid > 0 ? `${formatMoney(earned - paid)} to receive` : "Not paid yet"}</dd></div>
        <div><dt className="text-xs text-muted">Full commission at target</dt><dd className="text-2xl font-bold text-ink">{target ? formatMoney(full) : "—"}</dd></div>
        <div><dt className="text-xs text-muted">Still to earn</dt><dd className="text-2xl font-bold text-ink">{target ? formatMoney(Math.max(0, full - earned)) : "—"}</dd></div>
      </dl>
      {target > 0 && rate > 0 ? (
        <div className="mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-[#873CFF] to-[#E04FD8]" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{percent}% of your full commission earned so far.</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">Your target or commission rate is not set yet. The Super Admin sets them under Team.</p>
      )}
    </section>
  );
}
