import { Kpis } from "@/components/dashboard/widgets";
import { Check, Flame, Lock, Sparkles, Wallet } from "lucide-react";
import { GoalCards } from "@/components/dashboard/goal-cards";
import { PageHeader } from "@/components/ui/card";
import Link from "next/link";
import { requireAction } from "@/lib/auth";
import { periodNote } from "@/lib/dashboard";
import { todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { MONTHS } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { formatDay } from "@/lib/utils";
import { commissionPaid, dailyActivity, sellerFor } from "@/lib/my-sales";
import { param, type SearchParams } from "@/lib/pagination";
import { goalsFor } from "@/lib/sales-targets";
import { Payment } from "@/models/payment";

export const metadata = { title: "Targets & Commission" };

const MILESTONES = [25, 50, 75, 100] as const;

const bar = (value: number) => (
  <div className="h-2.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-white/90" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
);

export default async function MyTargetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("targets.view");
  const today = todayISO();
  const month = today.slice(0, 7);
  await connectDb();
  const seller = await sellerFor(user, param(await searchParams, "seller"));
  const [goals, collected, daily, payout] = await Promise.all([
    goalsFor(seller.username),
    Payment.aggregate<{ n: number }>([{ $match: { owner: seller.username, status: "confirmed", date: new RegExp(`^${month}`) } }, { $group: { _id: null, n: { $sum: "$amount" } } }]),
    dailyActivity(seller.username, today, today),
    commissionPaid(seller.username, month),
  ]);
  const done = collected[0]?.n ?? 0;
  const target = goals.target;
  const earned = Math.round(done * goals.rate) / 100;
  const paid = payout.paid;
  const toReceive = Math.max(0, Math.round((earned - paid) * 100) / 100);
  const paidBadge = earned <= 0 ? null : paid >= earned ? { text: `Paid${payout.lastDate ? ` · ${formatDay(payout.lastDate)}` : ""}`, tone: "bg-emerald-400/20 text-emerald-300" } : paid > 0 ? { text: `${formatMoney(paid)} paid · ${formatMoney(toReceive)} pending`, tone: "bg-amber-400/20 text-amber-300" } : { text: "Pending payment", tone: "bg-amber-400/20 text-amber-300" };
  const now = daily[0];
  const left = Math.max(0, target - done);
  const percent = target ? Math.min(100, Math.round((100 * done) / target)) : 0;
  const note = periodNote(month.slice(0, 4), month.slice(5), MONTHS);
  const next = MILESTONES.find((m) => target && done < (target * m) / 100);
  const nextSales = next ? (target * next) / 100 : 0;
  const nextGain = ((nextSales - done) * goals.rate) / 100;

  return (
    <>
      <PageHeader title="Targets & Commission" subtitle={seller.viewing ? `${seller.name} (${seller.username}) · view only` : "Every approved payment puts money in your pocket. Here is where you stand."}>
        {seller.viewing && (
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link prefetch={false} href="/sales-team" className="rounded-xl bg-white px-4 py-2 ring-1 ring-line hover:bg-brand-50">Back to team</Link>
            <Link prefetch={false} href={`/my-targets/history?seller=${seller.username}`} className="rounded-xl bg-brand-600 px-4 py-2 text-white">History</Link>
          </div>
        )}
      </PageHeader>

      <section className="relative mb-5 overflow-hidden rounded-3xl bg-[#0B1026] p-6 text-white shadow-lg sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#873CFF]/30 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#B58CFF]"><Wallet className="h-4 w-4" />{seller.viewing ? `${seller.name} has earned` : "You have earned"} · {note}</p>
            <p className="mt-2 text-5xl font-extrabold tracking-tight sm:text-6xl">{formatMoney(earned)}</p>
            {paidBadge && <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${paidBadge.tone}`}>{paidBadge.text}</span>}
            <p className="mt-2 text-sm text-white/85">{goals.rate}% commission on {formatMoney(done)} of approved sales.</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
            {target > 0 ? (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold"><Flame className="h-4 w-4" />{percent >= 100 ? "Target achieved!" : `${percent}% of your target`}</p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#873CFF] to-[#B58CFF]" style={{ width: `${percent}%` }} /></div>
                <p className="mt-3 text-sm text-white/90">
                  {next ? <>Collect <b>{formatMoney(nextSales - done)}</b> more and you will add <b>{formatMoney(nextGain)}</b> to your earnings.</> : <>You are above target. Every extra sale still earns {goals.rate}%.</>}
                </p>
              </>
            ) : (
              <p className="text-sm text-white/90">Your monthly target is not fixed yet. The Super Admin sets it under Team, and your milestones appear here.</p>
            )}
          </div>
        </div>
      </section>

      <Kpis items={[
        { label: "Commission rate", value: `${goals.rate}%`, hint: "On approved payments" },
        { label: "Sales this month", value: formatMoney(done), hint: target ? `${formatMoney(left)} to target` : "No target set" },
        { label: "Paid to you", value: formatMoney(paid), hint: earned > 0 && paid >= earned ? "Fully paid" : "Paid through payroll" },
        { label: "Still to receive", value: formatMoney(toReceive), hint: toReceive > 0 ? "Earned, not paid yet" : "Nothing pending" },
        { label: "At 100% of target", value: formatMoney((target * goals.rate) / 100), hint: "What a full month pays" },
      ]} />

      <GoalCards monthPercent={percent} hasTarget={target > 0} leads={now?.leads ?? 0} leadGoal={goals.leads} calls={now?.answered ?? 0} callGoal={goals.calls} />

      <h2 className="mb-1 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-brand-600" />Your earning milestones</h2>
      <p className="mb-3 text-xs text-muted">What you will have earned when you reach each point of your monthly target.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MILESTONES.map((m) => {
          const sales = (target * m) / 100;
          const reached = Boolean(target) && done >= sales;
          const isNext = next === m;
          return (
            <article key={m} className={`relative rounded-2xl border p-5 ${reached ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100" : isNext ? "border-brand-300 bg-gradient-to-br from-brand-50 to-white ring-2 ring-brand-300" : "border-line bg-white"}`}>
              <span className={`absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full ${reached ? "bg-emerald-500 text-white" : isNext ? "bg-brand-600 text-white" : "bg-canvas text-muted"}`}>
                {reached ? <Check className="h-4 w-4" /> : isNext ? <Flame className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{m}% of target</p>
              <p className="mt-2 text-2xl font-extrabold text-ink">{target ? formatMoney((sales * goals.rate) / 100) : "—"}</p>
              <p className="text-xs text-muted">commission at {target ? formatMoney(sales) : "—"} sales</p>
              <p className={`mt-3 text-xs font-semibold ${reached ? "text-emerald-700" : isNext ? "text-brand-700" : "text-muted"}`}>{reached ? "Unlocked. Well done!" : isNext ? "Next goal. Keep going!" : "Locked"}</p>
            </article>
          );
        })}
      </div>
    </>
  );
}
