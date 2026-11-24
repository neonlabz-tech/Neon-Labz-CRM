import { Bars, Kpis, PALETTE, Panel } from "@/components/dashboard/widgets";
import { AutoForm } from "@/components/ui/auto-form";
import { DataTable } from "@/components/ui/data-table";
import { goalsFor } from "@/lib/sales-targets";
import { Payment } from "@/models/payment";
import { PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/pagination";
import { dateRange, dayRange, readRange } from "@/lib/sales-range";
import { Invoice } from "@/models/invoice";
import { salesLeads } from "@/lib/own";
import { LEAD_STAGES, Lead } from "@/models/lead";
import { Quotation } from "@/models/quotation";
import { User } from "@/models/user";

export const metadata = { title: "Sales reports" };

export default async function SalesReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("sales.targets");
  const sp = await searchParams;
  const range = readRange(sp);
  const seller = param(sp, "seller");
  await connectDb();

  const days = dayRange(range);
  const created = dateRange(range);
  const [sellers, invoices, leads] = await Promise.all([
    User.find({ role: "sales" }).select("username fullName").sort({ username: 1 }).lean(),
    Invoice.find({ approval: "approved", ...(seller ? { salesOwner: seller } : {}), ...(days ? { date: days } : {}) }).select("quoteId amount").lean(),
    Lead.find({ ...(seller ? { owner: seller } : {}), ...(created ? { createdAt: created } : {}), ...salesLeads(user.username) }).select("status service owner").lean(),
  ]);

  const team = sellers.filter((u) => !seller || u.username === seller);
  const [callRows, collectedRows, rates] = await Promise.all([
    Lead.aggregate<{ _id: string; calls: number; answered: number }>([
      { $match: { owner: { $in: team.map((u) => u.username) } } },
      { $unwind: "$calls" },
      { $match: { ...(days ? { "calls.date": days } : {}) } },
      { $group: { _id: "$owner", calls: { $sum: 1 }, answered: { $sum: { $cond: [{ $eq: ["$calls.outcome", "Answered"] }, 1, 0] } } } },
    ]),
    Payment.aggregate<{ _id: string; n: number }>([{ $match: { status: "confirmed", owner: { $in: team.map((u) => u.username) }, ...(days ? { date: days } : {}) } }, { $group: { _id: "$owner", n: { $sum: "$amount" } } }]),
    Promise.all(team.map(async (u) => [u.username, (await goalsFor(u.username)).rate] as const)),
  ]);
  const callsOf = new Map(callRows.map((row) => [row._id, row]));
  const paidBy = new Map(collectedRows.map((row) => [row._id, row.n]));
  const rateOf = new Map(rates);
  const activity = team.map((u) => {
    const mine = leads.filter((lead) => lead.owner === u.username);
    const got = paidBy.get(u.username) ?? 0;
    return { username: u.username, name: u.fullName || u.username, leads: mine.length, followUps: callsOf.get(u.username)?.calls ?? 0, answered: callsOf.get(u.username)?.answered ?? 0, collected: got, commission: (got * (rateOf.get(u.username) ?? 0)) / 100 };
  });

  const quotes = await Quotation.find({ _id: { $in: invoices.map((i) => i.quoteId) } }).select("leadId").lean();
  const leadOfQuote = new Map(quotes.map((quote) => [String(quote._id), quote.leadId]));
  const serviceOfLead = new Map((await Lead.find({ leadId: { $in: quotes.map((quote) => quote.leadId) } }).select("leadId service").lean()).map((lead) => [lead.leadId, lead.service]));

  const byService = new Map<string, number>();
  for (const invoice of invoices) {
    const service = serviceOfLead.get(leadOfQuote.get(String(invoice.quoteId)) ?? "") || "Other";
    byService.set(service, (byService.get(service) ?? 0) + invoice.amount);
  }
  const collected = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const stages = LEAD_STAGES.map((stage) => ({ label: stage, value: leads.filter((lead) => lead.status === stage).length }));

  return (
    <>
      <PageHeader title="Sales reports" subtitle="Confirmed money by service, and where every lead stands." />
      <AutoForm className="mb-5 flex flex-wrap gap-2">
        <input type="date" name="from" defaultValue={range.from} aria-label="From date" className="h-11 rounded-xl border border-line bg-white px-3 text-sm" />
        <input type="date" name="to" defaultValue={range.to} aria-label="To date" className="h-11 rounded-xl border border-line bg-white px-3 text-sm" />
        <select name="seller" defaultValue={seller} aria-label="Salesperson" className="h-11 rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">All salespeople</option>
          {sellers.map((u) => <option key={u.username} value={u.username}>{u.fullName || u.username}</option>)}
        </select>
      </AutoForm>
      <Kpis items={[{ label: "Confirmed collections", value: formatMoney(collected) }, { label: "Leads", value: leads.length }, { label: "Converted", value: leads.filter((lead) => lead.status === "Converted").length }]} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Bars title="Confirmed collections by service" format="money" empty="No approved payments in this range." data={[...byService].map(([label, value], index) => ({ id: label, label, value, color: PALETTE[index % PALETTE.length]! }))} />
        <Bars title="Lead pipeline" data={stages.map((stage, index) => ({ id: stage.label, label: stage.label, value: stage.value, color: PALETTE[index % PALETTE.length]! }))} />
      </div>
      <div className="mt-5">
        <Panel title="Team activity summary" empty={activity.length ? undefined : "No sales team yet."}>
          {activity.length > 0 && (
            <DataTable
              rows={activity}
              rowKey={(r) => r.username}
              columns={[
                { header: "Salesperson", cell: (r) => r.name },
                { header: "Leads", cell: (r) => r.leads },
                { header: "Follow-ups", cell: (r) => r.followUps },
                { header: "Answered calls", cell: (r) => r.answered },
                { header: "Collections", cell: (r) => formatMoney(r.collected) },
                { header: "Commission", cell: (r) => formatMoney(r.commission) },
              ]}
            />
          )}
        </Panel>
      </div>
    </>
  );
}
