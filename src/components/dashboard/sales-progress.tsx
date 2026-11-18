import { formatMoney } from "@/lib/money";

/** A salesperson's collected money against their own target, on a dark card (the same look as the Super Admin's company target). */
export function SalesProgress({ collected, target, note }: { collected: number; target: number; note: string }) {
  const percent = target ? Math.round((100 * collected) / target) : 0;
  const left = Math.max(0, target - collected);
  return (
    <section className="mb-5 rounded-2xl bg-[#0B1026] p-5 text-white shadow-sm sm:p-6" aria-label="Sales progress">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#B58CFF]">Sales progress</p>
          <p className="mt-1 text-sm text-[#D1D5DB]">{note}</p>
        </div>
        {target > 0 && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${percent >= 100 ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white"}`}>
            {percent >= 100 ? `Target achieved · ${percent}%` : `${percent}%`}
          </span>
        )}
      </div>
      {target > 0 ? (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><dt className="text-xs text-[#9CA3AF]">Achievement</dt><dd className="text-2xl font-bold">{percent}%</dd></div>
            <div><dt className="text-xs text-[#9CA3AF]">Collected</dt><dd className="text-2xl font-bold">{formatMoney(collected)}</dd></div>
            <div><dt className="text-xs text-[#9CA3AF]">Target</dt><dd className="text-2xl font-bold">{formatMoney(target)}</dd></div>
            <div><dt className="text-xs text-[#9CA3AF]">{left > 0 ? "Still to collect" : "Above target by"}</dt><dd className="text-2xl font-bold">{formatMoney(left > 0 ? left : collected - target)}</dd></div>
          </dl>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.min(100, percent)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-[#873CFF] to-[#B58CFF]" style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-[#D1D5DB]">Your sales target is not fixed yet. The Super Admin sets it for you under Team.</p>
      )}
    </section>
  );
}
