import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { Gauge } from "./charts";

/** Company target against what has been collected in the chosen period, on a dark card. */
export function CompanyTarget({ collected, target, note }: { collected: number; target: number; note: string }) {
  const percent = target ? Math.round((100 * collected) / target) : 0;
  const left = Math.max(0, target - collected);
  return (
    <section className="mb-5 rounded-2xl bg-[#0B1026] p-5 text-white shadow-sm sm:p-6" aria-label="Company target against collected">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#B58CFF]">Company target vs collected</p>
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
          <div className="mt-4 grid items-center gap-5 lg:grid-cols-[15rem_1fr]">
          <Gauge value={percent} dark label="of the target collected" />
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-4">
            <div><dt className="text-xs text-[#9CA3AF]">Collected</dt><dd className="text-xl font-bold">{formatMoney(collected)}</dd></div>
            <div><dt className="text-xs text-[#9CA3AF]">Company target</dt><dd className="text-xl font-bold">{formatMoney(target)}</dd></div>
            <div><dt className="text-xs text-[#9CA3AF]">{left > 0 ? "Still to collect" : "Above target by"}</dt><dd className="text-xl font-bold">{formatMoney(left > 0 ? left : collected - target)}</dd></div>
          </dl>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-[#D1D5DB]">
          No company target is set yet. <Link prefetch={false} href="/sales-settings" className="font-semibold text-[#B58CFF] hover:underline">Set it in Settings</Link>.
        </p>
      )}
    </section>
  );
}
