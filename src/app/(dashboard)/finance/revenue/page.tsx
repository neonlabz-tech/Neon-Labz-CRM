import { Banknote, Users } from "lucide-react";
import { RevenueForm } from "@/components/finance/forms";
import { PeriodFilter } from "@/components/finance/period-filter";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Stat } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { connectDb } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { MONTHS, dateRange, readPeriod } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { isId } from "@/lib/project-access";
import { deleteRevenueAction } from "@/server/finance-actions";
import { Revenue } from "@/models/finance";
import { ManualSale } from "@/models/manual-sale";
import { UNASSIGNED } from "@/models/manual-sale-values";
import { Payment } from "@/models/payment";
import { User } from "@/models/user";

export const metadata = { title: "Finance · Revenue" };

type Row = { _id: string; source: "manual" | "sales" | "sale"; salesPerson: string; date: string; description: string; amount: number };

export default async function RevenuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, todayISO());
  const { year, month, prefix, from, to } = period;
  const person = param(sp, "person");
  const page = pageOf(sp);
  const edit = param(sp, "edit");
  const adding = param(sp, "new") === "1";

  await connectDb();
  const people = await User.find({ role: "sales" }).select("username fullName").sort({ username: 1 }).lean();
  const dateMatch = prefix || from || to ? { date: dateRange(period) } : {};
  const personMatch = person ? { salesPerson: person } : {};

  const [result, editing] = await Promise.all([
    Revenue.aggregate<{ rows: Row[]; stats: { total: number; n: number }[] }>([
      { $match: { ...dateMatch, ...personMatch } },
      { $project: { source: { $literal: "manual" }, salesPerson: 1, date: 1, description: 1, amount: 1 } },
      {
        $unionWith: {
          coll: Payment.collection.name,
          pipeline: [
            { $match: { status: "confirmed", ...dateMatch, ...(person ? { owner: person } : {}) } },
            { $project: { source: { $literal: "sales" }, salesPerson: "$owner", date: 1, description: { $concat: ["$clientName", " · ", "$type"] }, amount: 1 } },
          ],
        },
      },
      {
        // Money collected on confirmed manual sales: one row per receipt (an older sale with no receipt lines counts once, on the sale date).
        $unionWith: {
          coll: ManualSale.collection.name,
          pipeline: [
            { $match: { status: "confirmed", ...(person ? { owner: person } : {}) } },
            { $project: { saleCode: 1, business: 1, owner: 1, lines: { $cond: [{ $gt: [{ $size: { $ifNull: ["$payments", []] } }, 0] }, "$payments", [{ amount: "$collected", date: "$date" }]] } } },
            { $unwind: "$lines" },
            ...(dateMatch.date ? [{ $match: { "lines.date": dateMatch.date } }] : []),
            { $project: { source: { $literal: "sale" }, salesPerson: { $cond: [{ $eq: ["$owner", UNASSIGNED] }, "", "$owner"] }, date: "$lines.date", description: { $concat: ["$business", " · ", { $ifNull: ["$lines.receiptNo", "$saleCode"] }] }, amount: "$lines.amount" } },
          ],
        },
      },
      { $sort: { date: -1, _id: -1 } },
      { $facet: { rows: [{ $skip: skipOf(page) }, { $limit: limitOf(page) }], stats: [{ $group: { _id: null, total: { $sum: "$amount" }, n: { $sum: 1 } } }] } },
    ]),
    isId(edit) ? Revenue.findById(edit).lean() : null,
  ]);
  const rows = result[0]?.rows ?? [];
  const total = result[0]?.stats[0]?.total ?? 0;
  const count = result[0]?.stats[0]?.n ?? 0;
  const nameOf = new Map(people.map((p) => [p.username, p.fullName || p.username]));
  const label = from || to ? `${from || "start"} to ${to || "today"}` : `${month ? MONTHS[Number(month) - 1] : "All months"} ${year || "all years"}`;

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Sales persons" value={people.length} icon={<Users className="h-5 w-5" />} />
        <Stat label="Revenue" value={formatMoney(total)} hint={label} icon={<Banknote className="h-5 w-5" />} />
        <div className="flex justify-end sm:self-center"><AddLink href="?new=1">Add other revenue</AddLink></div>
      </div>
      {(adding || editing) && (
        <Panel title={editing ? "Edit other revenue" : "Add other revenue"} closeHref="/finance/revenue">
          <RevenueForm people={people.map((p) => ({ username: p.username, name: p.fullName || p.username }))} values={editing ? { id: String(editing._id), salesPerson: editing.salesPerson, date: editing.date, description: editing.description, amount: String(editing.amount) } : { salesPerson: "", date: todayISO(), description: "", amount: "" }} />
        </Panel>
      )}
      <PeriodFilter basePath="/finance/revenue" year={year} month={month} range={{ from, to }} extras={[
        { name: "person", label: "All sales persons", value: person, options: people.map((p) => ({ value: p.username, label: `${p.username} · ${p.fullName || ""}` })) },
      ]} />
      {rows.length === 0 ? <EmptyState title="No revenue for this period" text="Approved sales payments, manual sales and other revenue appear here." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => `${r.source}-${r._id}-${r.description}-${r.date}`}
          columns={[
            { header: "Source", cell: (r) => <Badge tone={r.source === "manual" ? "info" : "brand"}>{r.source === "sales" ? "Sales payment" : r.source === "sale" ? "Manual sale" : "Other"}</Badge> },
            { header: "Sales person", cell: (r) => (r.salesPerson ? `${nameOf.get(r.salesPerson) ?? ""} · ${r.salesPerson}` : "—") },
            { header: "Date", cell: (r) => r.date },
            { header: "Description", cell: (r) => r.description },
            { header: "Amount", cell: (r) => formatMoney(r.amount) },
            { header: "Actions", cell: (r) => (r.source === "manual" ? <RowActions id={String(r._id)} editHref={`?edit=${r._id}`} remove={{ action: deleteRevenueAction, title: "Delete this revenue record?", text: "This cannot be undone." }} /> : "—") },
          ]}
        />
      )}
      <Pagination page={page} total={count} query={{ person, year: year || "all", month: month || "all", from, to }} />
    </>
  );
}
