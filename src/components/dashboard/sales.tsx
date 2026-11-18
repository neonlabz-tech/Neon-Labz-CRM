import { PeriodFilter } from "@/components/finance/period-filter";
import { PdfLink } from "@/components/ui/pdf-link";
import { connectDb } from "@/lib/db";
import { dateIn, group, groupNamed, periodNote } from "@/lib/dashboard";
import { todayISO } from "@/lib/dates";
import { MONTHS, readPeriod } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { goalsFor, periodTarget, personalTarget } from "@/lib/sales-targets";
import type { SearchParams } from "@/lib/pagination";
import { Invoice } from "@/models/invoice";
import { LEAD_SOURCES, LEAD_STAGES, Lead } from "@/models/lead";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";
import { TopPackages } from "./top-packages";
import { commissionPaid } from "@/lib/my-sales";
import { GoalCards } from "./goal-cards";
import { CommissionTrack } from "./commission-track";
import { SalesProgress } from "./sales-progress";
import { Bars, ChartGrid, Kpis, Panel, Ring, slices, toCounts, withNames } from "./widgets";

type Row = { _id: unknown; n: number };
type NamedRow = Row & { names: string[] };

export async function SalesDashboard({ username, sp }: { username: string; sp: SearchParams }) {
  const { year, month, prefix } = readPeriod(sp, todayISO());
  await connectDb();
  const mine = { owner: username };
  const dates = dateIn(prefix, "date");
  const today = todayISO();
  const [stages, sources, quotes, collected, paymentStates, approved, goals, ownTarget, newToday, quotedToday, loggedToday, dueCount] = await Promise.all([
    Lead.aggregate<NamedRow>(groupNamed("status", "business", { ...mine, ...dates })),
    Lead.aggregate<Row>(group("source", { ...mine, ...dates })),
    Quotation.aggregate<Row>([{ $match: { ...mine, ...dates } }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$total" } } }]),
    Payment.aggregate<Row>([{ $match: { ...mine, status: "confirmed", ...dates } }, { $group: { _id: null, n: { $sum: "$amount" } } }]),
    Payment.aggregate<NamedRow>(groupNamed("status", "clientName", { ...mine, ...dates })),
    Invoice.find({ salesOwner: username, approval: "approved", ...dates }).select("receiptNo clientName amount type").sort({ approvedAt: -1 }).limit(8).lean(),
    goalsFor(username),
    personalTarget(username),
    Lead.countDocuments({ ...mine, date: today }),
    Quotation.countDocuments({ ...mine, date: today }),
    Lead.aggregate<Row>([{ $match: mine }, { $unwind: "$calls" }, { $match: { "calls.date": today } }, { $group: { _id: { $cond: [{ $eq: ["$calls.outcome", "Answered"] }, "answered", "$calls.status"] }, n: { $sum: 1 } } }]),
    Lead.countDocuments({ ...mine, next: { $gt: "", $lte: today }, status: { $nin: ["Converted", "Lost"] } }),
  ]);
  const stage = toCounts(stages);
  const leads = Object.values(stage).reduce((a, b) => a + b, 0);
  const quoteTotal = (quotes[0] as unknown as { total?: number } | undefined)?.total ?? 0;
  const states = toCounts(paymentStates);
  const done = collected[0]?.n ?? 0;
  const target = periodTarget(ownTarget, year, month);
  const logged = toCounts(loggedToday);
  const payout = await commissionPaid(username, prefix);
  const mission: [string, string | number][] = [
    ["Quotations sent", quotedToday],
    ["Demos scheduled", logged["Demo Scheduled"] ?? 0],
    ["Payment promised", logged["Payment Promised"] ?? 0],
    ["Follow-ups due", dueCount],
  ];
  return (
    <>
      <PeriodFilter year={year} month={month} basePath="/dashboard" />
      <SalesProgress collected={done} target={target} note={periodNote(year, month, MONTHS)} />
      <CommissionTrack rate={goals.rate} collected={done} target={target} paid={payout.paid} />
      <GoalCards monthPercent={target ? Math.min(100, Math.round((100 * done) / target)) : 0} hasTarget={target > 0} leads={newToday} leadGoal={goals.leads} calls={logged.answered ?? 0} callGoal={goals.calls} />
      <Panel title={`Today's mission · ${today}`}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mission.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-brand-50/60 p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Kpis items={[
        { label: "Leads", value: leads },
        { label: "Converted", value: stage.Converted ?? 0 },
        { label: "Quotations", value: quotes[0]?.n ?? 0, hint: formatMoney(quoteTotal) },
        { label: "Waiting approval", value: states.pending ?? 0 },
      ]} />
      <ChartGrid>
        <Ring title="Lead stages" data={withNames(slices(LEAD_STAGES.map((s) => [s, s] as const), stage), stages)} />
        <Ring title="Payments" data={withNames(slices([["pending", "Waiting for approval"], ["confirmed", "Approved"], ["cancelled", "Cancelled"]], states), paymentStates)} />
        <Bars title="Where leads come from" data={slices(LEAD_SOURCES.map((s) => [s, s] as const), toCounts(sources))} />
        <TopPackages owner={username} prefix={prefix} />
      </ChartGrid>
      <Panel title="Approved payment invoices" empty={approved.length ? undefined : "After the Super Admin approves a payment you recorded, its receipt appears here."}>
        {approved.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {approved.map((invoice) => (
              <li key={String(invoice._id)} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span><code>{invoice.receiptNo}</code> · {invoice.clientName} · {invoice.type}</span>
                <span className="flex items-center gap-3"><b>{formatMoney(invoice.amount)}</b><PdfLink kind="receipt" id={String(invoice._id)} label="View" /></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
