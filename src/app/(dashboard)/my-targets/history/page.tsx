import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { monthLabel } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { HISTORY_RANGES, dailyActivity, daysOf, payoutHistory, readHistoryRange, sellerFor } from "@/lib/my-sales";
import { param, type SearchParams } from "@/lib/pagination";
import { goalsFor } from "@/lib/sales-targets";
import { cn, formatDay } from "@/lib/utils";

export const metadata = { title: "Sales history" };

export default async function MyHistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("targets.view");
  const sp = await searchParams;
  const range = readHistoryRange(param(sp, "range"));
  const { from, to } = daysOf(range, todayISO());
  await connectDb();
  const seller = await sellerFor(user, param(sp, "seller"));
  const keep = seller.viewing ? `&seller=${seller.username}` : "";
  const [rows, goals, payouts] = await Promise.all([dailyActivity(seller.username, from, to), goalsFor(seller.username), payoutHistory(seller.username)]);
  const total = rows.reduce((a, r) => ({ calls: a.calls + r.calls, leads: a.leads + r.leads, quotations: a.quotations + r.quotations, orders: a.orders + r.orders, sales: a.sales + r.sales }), { calls: 0, leads: 0, quotations: 0, orders: 0, sales: 0 });
  const commission = (sales: number) => formatMoney((sales * goals.rate) / 100);
  const th = "whitespace-nowrap px-4 py-3";
  const td = "whitespace-nowrap px-4 py-3";

  return (
    <>
      <PageHeader title="History" subtitle={seller.viewing ? `${seller.name} (${seller.username}) · view only` : "What you did each day: calls, new leads, quotations, approved payments and commission."}>
        <div className="flex flex-wrap items-center gap-2" role="tablist">
          {seller.viewing && <Link prefetch={false} href={`/my-targets?seller=${seller.username}`} className="mr-2 text-sm font-semibold text-brand-700 hover:underline">Back to targets</Link>}
          {HISTORY_RANGES.map((r) => (
            <Link prefetch={false} key={r.id} href={`/my-targets/history?range=${r.id}${keep}`} role="tab" aria-selected={r.id === range} className={cn("rounded-xl px-4 py-2 text-sm font-semibold", r.id === range ? "bg-brand-600 text-white" : "bg-white text-ink ring-1 ring-line hover:bg-brand-50")}>{r.label}</Link>
          ))}
        </div>
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyState title="No activity in this period" text="Calls, leads, quotations and approved payments appear here as you work." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-canvas text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr><th className={th}>Date</th><th className={th}>Calls made</th><th className={th}>New leads</th><th className={th}>Quotations</th><th className={th}>Approved payments</th><th className={th}>Sales (LKR)</th><th className={th}>Commission</th></tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {rows.map((r) => (
                <tr key={r.date} className="hover:bg-brand-50/40">
                  <td className={cn(td, "font-semibold")}>{formatDay(r.date)}</td>
                  <td className={td}>{r.calls}<span className="text-xs text-muted"> ({r.answered} answered)</span></td>
                  <td className={td}>{r.leads}</td>
                  <td className={td}>{r.quotations}</td>
                  <td className={td}>{r.orders}</td>
                  <td className={td}>{formatMoney(r.sales)}</td>
                  <td className={cn(td, "font-semibold text-success")}>{commission(r.sales)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line bg-canvas font-bold">
              <tr><td className={td}>Total</td><td className={td}>{total.calls}</td><td className={td}>{total.leads}</td><td className={td}>{total.quotations}</td><td className={td}>{total.orders}</td><td className={td}>{formatMoney(total.sales)}</td><td className={cn(td, "text-success")}>{commission(total.sales)}</td></tr>
            </tfoot>
          </table>
        </Card>
      )}
      <p className="mt-3 text-xs text-muted">Approved payments is the number of your payments the Super Admin approved that day, and Sales is their total amount. Commission uses your rate of {goals.rate}%.</p>
      <h2 className="mb-3 mt-8 font-semibold">Commission payouts</h2>
      {payouts.length === 0 ? (
        <p className="text-sm text-muted">Your monthly commission and whether it has been paid appear here.</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-canvas text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr><th className={th}>Month</th><th className={th}>Approved sales</th><th className={th}>Commission earned</th><th className={th}>Paid</th><th className={th}>To receive</th><th className={th}>Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {payouts.map((p) => (
                <tr key={p.month} className="hover:bg-brand-50/40">
                  <td className={cn(td, "font-semibold")}>{monthLabel(p.month)}</td>
                  <td className={td}>{formatMoney(p.sales)}</td>
                  <td className={td}>{formatMoney(p.earned)}</td>
                  <td className={td}>{formatMoney(p.paid)}</td>
                  <td className={cn(td, p.earned > p.paid ? "font-semibold text-danger" : "")}>{formatMoney(Math.max(0, Math.round((p.earned - p.paid) * 100) / 100))}</td>
                  <td className={td}><Badge tone={p.status === "Paid" ? "success" : "warning"}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-3 text-xs text-muted">Paid is the commission the company has paid you through payroll. Earned uses your current rate of {goals.rate}%.</p>
    </>
  );
}
