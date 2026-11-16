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
import { Package } from "@/models/package";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";
import { Bars, ChartGrid, Hero, Kpis, PALETTE, Panel, Ring, slices, toCounts, withNames } from "./widgets";

type Row = { _id: unknown; n: number };
type NamedRow = Row & { names: string[] };

export async function SalesDashboard({ username, sp }: { username: string; sp: SearchParams }) {
  const { year, month, prefix } = readPeriod(sp, todayISO());
  await connectDb();
  const mine = { owner: username };
  const dates = dateIn(prefix, "date");
  const today = todayISO();
  const [stages, sources, quotes, collected, paymentStates, approved, packageKinds, goals, ownTarget, newToday, quotedToday, loggedToday, dueCount] = await Promise.all([
    Lead.aggregate<NamedRow>(groupNamed("status", "business", { ...mine, ...dates })),
    Lead.aggregate<Row>(group("source", { ...mine, ...dates })),
    Quotation.aggregate<Row>([{ $match: { ...mine, ...dates } }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$total" } } }]),
    Payment.aggregate<Row>([{ $match: { ...mine, status: "confirmed", ...dates } }, { $group: { _id: null, n: { $sum: "$amount" } } }]),
    Payment.aggregate<NamedRow>(groupNamed("status", "clientName", { ...mine, ...dates })),
    Invoice.find({ salesOwner: username, approval: "approved", ...dates }).select("receiptNo clientName amount type").sort({ approvedAt: -1 }).limit(8).lean(),
    Package.aggregate<NamedRow>(groupNamed("category", "name", { status: "active" })),
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
  const percent = target ? Math.min(100, Math.round((100 * done) / target)) : 0;
  const logged = toCounts(loggedToday);
  const mission: [string, string | number][] = [
    ["New leads", goals.leads ? `${newToday} / ${goals.leads}` : newToday],
    ["Answered calls", goals.calls ? `${logged.answered ?? 0} / ${goals.calls}` : (logged.answered ?? 0)],
    ["Quotations sent", quotedToday],
    ["Demos scheduled", logged["Demo Scheduled"] ?? 0],
    ["Payment promised", logged["Payment Promised"] ?? 0],
    ["Follow-ups due", dueCount],
  ];
  return (
    <>
      <PeriodFilter year={year} month={month} basePath="/dashboard" />
      <Hero kicker={username} title="Sales dashboard" note={periodNote(year, month, MONTHS)} badge={`${stage.Converted ?? 0} converted`} />
      <Panel title={`Today's mission · ${today}`}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {mission.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-brand-50/60 p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Kpis items={[
        { label: "Sales target", value: target ? formatMoney(target) : "Not fixed", hint: periodNote(year, month, MONTHS) },
        { label: "Remaining target", value: target ? formatMoney(Math.max(0, target - done)) : "—", hint: target ? "To reach the target" : "Target not fixed" },
        { label: "Earned commission", value: formatMoney((done * goals.rate) / 100), hint: `${goals.rate}% on approved payments` },
        { label: "Leads", value: leads },
        { label: "Converted", value: stage.Converted ?? 0 },
        { label: "Quotations", value: quotes[0]?.n ?? 0, hint: formatMoney(quoteTotal) },
        { label: "Collected", value: formatMoney(collected[0]?.n ?? 0), hint: "Approved payments" },
        { label: "Waiting approval", value: states.pending ?? 0 },
      ]} />
      <Panel title="Sales progress">
        <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-xs text-muted">Achievement</p><p className="text-lg font-bold">{percent}%</p></div>
          <div><p className="text-xs text-muted">Collected</p><p className="text-lg font-bold">{formatMoney(done)}</p></div>
          <div><p className="text-xs text-muted">Target</p><p className="text-lg font-bold">{target ? formatMoney(target) : "Not fixed"}</p></div>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-brand-50" aria-hidden="true"><div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} /></div>
      </Panel>
      <ChartGrid>
        <Ring title="Lead stages" data={withNames(slices(LEAD_STAGES.map((s) => [s, s] as const), stage), stages)} />
        <Ring title="Payments" data={withNames(slices([["pending", "Waiting for approval"], ["confirmed", "Approved"], ["cancelled", "Cancelled"]], states), paymentStates)} />
        <Bars title="Where leads come from" data={slices(LEAD_SOURCES.map((s) => [s, s] as const), toCounts(sources))} />
        <Bars title="Packages on offer" data={packageKinds.map((row, index) => ({ id: String(row._id), label: String(row._id), value: row.n, names: row.names, color: PALETTE[index % PALETTE.length]! }))} />
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
