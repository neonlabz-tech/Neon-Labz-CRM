import { PdfLink } from "@/components/ui/pdf-link";
import { todayISO } from "@/lib/dates";
import { ApprovalActions } from "@/components/sales/approval-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { AddLink, Panel } from "@/components/ui/panel";
import { DialogButton } from "@/components/ui/dialog-button";
import { PaymentReview } from "@/components/sales/payment-review";
import { ManualSaleActions } from "@/components/sales/manual-sale-actions";
import { SalePaymentButton } from "@/components/sales/sale-payment-form";
import { ManualSaleForm } from "@/components/sales/manual-sale-form";
import { isId } from "@/lib/project-access";
import { ManualSale } from "@/models/manual-sale";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { dayRange, readRange } from "@/lib/sales-range";
import { Kpis } from "@/components/dashboard/widgets";
import { goalsFor } from "@/lib/sales-targets";
import { Invoice } from "@/models/invoice";
import { Client } from "@/models/client";
import { Lead } from "@/models/lead";
import { Package } from "@/models/package";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";
import { User } from "@/models/user";

export const metadata = { title: "Approvals" };

const GOES_LABEL: Record<string, string> = { project: "Project", marketing: "Marketing", both: "Project + Marketing", own: "Super Admin (own)" };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("payments.approve");
  const sp = await searchParams;
  const q = param(sp, "q");
  const status = param(sp, "status") || "pending";
  const adding = param(sp, "new") === "1";
  const editId = param(sp, "edit");
  const page = pageOf(sp);
  const range = readRange(sp);

  const filter: Record<string, unknown> = {};
  if (status === "pending" || status === "approved") filter.approval = status;
  if (range.seller) filter.salesOwner = range.seller;
  const days = dayRange(range);
  if (days) filter.date = days;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ clientName: rx }, { receiptNo: rx }, { salesOwner: rx }, { clientCode: rx }];
  }

  await connectDb();
  const sellers = await User.find({ role: "sales" }).select("username fullName").sort({ username: 1 }).lean();
  const scope = { ...(range.seller ? { owner: range.seller } : {}), ...(days ? { date: days } : {}) };
  const [books, rows, total] = await Promise.all([
    Payment.aggregate<{ _id: unknown; confirmed: number; count: number }>([
      { $match: { status: { $ne: "cancelled" }, ...scope } },
      { $group: { _id: "$quoteId", confirmed: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, "$amount", 0] } }, count: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } } } },
    ]),
    Invoice.find(filter).select("receiptNo paymentId clientName clientCode salesOwner amount type method transactionId date approval quoteNumber quoteId quoteTotal").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Invoice.countDocuments(filter),
  ]);

  const manualFilter: Record<string, unknown> = {};
  if (range.seller) manualFilter.owner = range.seller;
  if (days) manualFilter.date = days;
  const [manualConfirmed, manualRows, editing] = await Promise.all([
    ManualSale.aggregate<{ n: number; collected: number; balance: number }>([{ $match: { ...manualFilter, status: "confirmed" } }, { $group: { _id: null, n: { $sum: 1 }, collected: { $sum: "$collected" }, balance: { $sum: { $subtract: ["$amount", "$collected"] } } } }]),
    status === "manual"
      ? ManualSale.find({ ...manualFilter, ...(q ? { $or: [{ business: new RegExp(escapeRegex(q), "i") }, { saleCode: new RegExp(escapeRegex(q), "i") }] } : {}) }).sort({ createdAt: -1 }).limit(200).lean()
      : Promise.resolve([]),
    editId && isId(editId) ? ManualSale.findById(editId).lean() : Promise.resolve(null),
  ]);
  const manual = manualConfirmed[0] ?? { n: 0, collected: 0, balance: 0 };

  const rowQuotes = await Quotation.find({ _id: { $in: rows.map((row) => row.quoteId) } }).select("leadId items").lean();
  const leadOfQuote = new Map(rowQuotes.map((quote) => [String(quote._id), quote.leadId]));
  const leadService = new Map((await Lead.find({ leadId: { $in: rowQuotes.map((quote) => quote.leadId) } }).select("leadId service").lean()).map((lead) => [lead.leadId, lead.service]));
  // The service shown is what was actually quoted, not what the lead first asked about.
  const serviceOf = new Map(rowQuotes.map((quote) => [quote.leadId, [...new Set(quote.items.map((i) => i.service).filter(Boolean))].join(", ") || leadService.get(quote.leadId) || ""]));
  const paidOf = new Map((await Payment.aggregate<{ _id: unknown; n: number }>([{ $match: { quoteId: { $in: rows.map((row) => row.quoteId) }, status: "confirmed" } }, { $group: { _id: "$quoteId", n: { $sum: "$amount" } } }])).map((row) => [String(row._id), row.n]));
  const proofOf = new Map((await Payment.find({ _id: { $in: rows.map((row) => row.paymentId) } }).select("proofUrl").lean()).map((p) => [String(p._id), p.proofUrl]));
  const rateOf = new Map(await Promise.all([...new Set(rows.map((row) => row.salesOwner))].map(async (owner) => [owner, (await goalsFor(owner)).rate] as const)));
  const quotes = await Quotation.find({ _id: { $in: books.map((b) => b._id) } }).select("total").lean();
  const totalOf = new Map(quotes.map((quote) => [String(quote._id), quote.total]));
  const collections = books.reduce((sum, b) => sum + b.confirmed, 0);
  const outstanding = books.reduce((sum, b) => sum + Math.max(0, (totalOf.get(String(b._id)) ?? 0) - b.confirmed), 0);
  const pending = await Invoice.countDocuments({ approval: "pending", ...(range.seller ? { salesOwner: range.seller } : {}), ...(days ? { date: days } : {}) });

  const today = todayISO();
  const packageList = await Package.find({ status: "active" }).select("name category").sort({ name: 1 }).limit(200).lean();

  return (
    <>
      <PageHeader title="Approvals" subtitle="Check each payment sent in by sales. Approving makes the client a client.">
        <AddLink href="/approvals?new=1">+ Record sale</AddLink>
      </PageHeader>
      {(adding || editing) && (
        <Panel title={editing ? "Review sale" : "Record a sale"} subtitle={editing?.saleCode} closeHref="/approvals?status=manual">
          <ManualSaleForm
            clients={(await Client.find().select("name").sort({ name: 1 }).limit(500).lean()).map((c) => c.name)}
            services={packageList.map((p) => p.name)}
            categories={Object.fromEntries(packageList.map((p) => [p.name.toLowerCase(), p.category]))}
            people={sellers.map((u) => ({ username: u.username, name: u.fullName || u.username }))}
            values={editing
              ? { id: String(editing._id), business: editing.business, date: editing.date, service: editing.service, owner: editing.owner, amount: String(editing.amount), collected: String(editing.collected), status: editing.status, goesTo: (editing.goesTo ?? "project") }
              : { business: "", date: todayISO(), service: "", owner: "", amount: "", status: "pending", goesTo: "project", collected: "0" }}
            paymentsLocked={(editing?.payments ?? []).length > 0}
          />
          {editing && (
            <section className="mt-6 border-t border-line pt-4" aria-label="Payments">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Payments · {formatMoney(editing.collected)} of {formatMoney(editing.amount)}</h3>
                {editing.status === "confirmed" && editing.amount - editing.collected > 0 && <SalePaymentButton id={String(editing._id)} code={editing.saleCode} balance={Math.round((editing.amount - editing.collected) * 100) / 100} today={today} />}
              </div>
              {(editing.payments ?? []).length === 0
                ? <p className="text-sm text-muted">{editing.status === "confirmed" ? "No payments yet." : "Confirm the sale to start recording payments."}</p>
                : (
                  <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                    {(editing.payments ?? []).map((p, i) => (
                      <li key={p.receiptNo} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <span><b>{p.receiptNo}</b> <span className="text-muted">· {p.date}{p.method ? ` · ${p.method}` : ""}{p.transactionId ? ` · ${p.transactionId}` : ""}</span></span>
                        <span className="flex items-center gap-2"><b>{formatMoney(p.amount)}</b><PdfLink kind="salepay" id={`${String(editing._id)}_${i + 1}`} label={`Receipt ${p.receiptNo}`} /></span>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          )}
        </Panel>
      )}
      <Kpis items={[{ label: "Confirmed sales", value: books.reduce((sum, b) => sum + b.count, 0) + manual.n }, { label: "Pending approval", value: pending }, { label: "Confirmed collections", value: formatMoney(collections + manual.collected) }, { label: "Outstanding balances", value: formatMoney(outstanding + manual.balance) }]} />
      <SearchBar q={q} placeholder="Search by client, receipt or sales person" range={range} filters={[{ name: "status", label: "Waiting for approval", value: status === "pending" ? "" : status, options: [{ value: "approved", label: "Approved" }, { value: "all", label: "All payments" }, { value: "manual", label: "Manual sales" }] }, { name: "seller", label: "All salespeople", value: range.seller, options: sellers.map((u) => ({ value: u.username, label: u.fullName || u.username })) }]} />
      {status === "manual" ? (
        manualRows.length === 0 ? <EmptyState title="No manual sales" text="Use Record sale for a sale that did not come through a quotation." /> : (
          <DataTable
            rows={manualRows}
            rowKey={(r) => String(r._id)}
            columns={[
              { header: "Sale ID", cell: (r) => r.saleCode },
              { header: "Client", cell: (r) => <span>{r.business}{r.clientCode && <span className="font-normal text-muted"> · {r.clientCode}</span>}</span> },
              { header: "Service", cell: (r) => r.service },
              { header: "Sales", cell: (r) => (r.owner === "unassigned" ? "Unassigned" : r.owner) },
              { header: "Goes to", cell: (r) => GOES_LABEL[r.goesTo] ?? "Project" },
              { header: "Sale value", cell: (r) => formatMoney(r.amount) },
              { header: "Collected", cell: (r) => formatMoney(r.collected) },
              { header: "Balance", cell: (r) => formatMoney(Math.max(0, r.amount - r.collected)) },
              { header: "Date", cell: (r) => r.date },
              { header: "Status", cell: (r) => <Badge tone={r.status === "confirmed" ? "success" : r.status === "rejected" ? "danger" : "warning"}>{r.status === "confirmed" ? "Confirmed" : r.status === "rejected" ? "Rejected" : "Pending"}</Badge> },
              { header: "Bill", cell: (r) => (
                (r.payments ?? []).length === 0 ? <span className="text-muted">—</span> : (
                  <span className="flex items-center gap-1.5">
                    {(r.payments ?? []).map((p, i) => <PdfLink key={p.receiptNo} kind="salepay" id={`${String(r._id)}_${i + 1}`} label={`Receipt ${p.receiptNo}`} />)}
                    {r.amount - r.collected <= 0 && <Badge tone="success">Paid in full</Badge>}
                  </span>
                )
              ) },
              { header: "Actions", cell: (r) => (
                <div className="flex items-center gap-2">
                  {r.status === "confirmed" && r.amount - r.collected > 0 && <SalePaymentButton id={String(r._id)} code={r.saleCode} balance={Math.round((r.amount - r.collected) * 100) / 100} today={today} />}
                  <ManualSaleActions id={String(r._id)} status={r.status} locked={(r.payments ?? []).length > 0} editHref={`/approvals?status=manual&edit=${String(r._id)}`} />
                </div>
              ) },
            ]}
          />
        )
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing to review" text="New payments from sales will appear here." />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Receipt", cell: (r) => r.receiptNo },
            { header: "Client", cell: (r) => <span>{r.clientName} <span className="font-normal text-muted">· {r.clientCode}</span></span> },
            { header: "Service", cell: (r) => serviceOf.get(leadOfQuote.get(String(r.quoteId)) ?? "") ?? "—" },
            { header: "Sales", cell: (r) => r.salesOwner },
            { header: "Amount", cell: (r) => formatMoney(r.amount) },
            { header: "Collected", cell: (r) => formatMoney(paidOf.get(String(r.quoteId)) ?? 0) },
            { header: "Balance", cell: (r) => formatMoney(Math.max(0, r.quoteTotal - (paidOf.get(String(r.quoteId)) ?? 0))) },
            { header: "Commission", cell: (r) => (r.approval === "approved" ? formatMoney(((r.amount) * (rateOf.get(r.salesOwner) ?? 0)) / 100) : "—") },
            { header: "Details", cell: (r) => `${r.type}${r.method ? ` · ${r.method}` : ""}${r.transactionId ? ` · ${r.transactionId}` : ""}` },
            { header: "Date", cell: (r) => r.date },
            { header: "Status", cell: (r) => <Badge tone={r.approval === "approved" ? "success" : "warning"}>{r.approval === "approved" ? "Approved" : "Waiting"}</Badge> },
            { header: "Actions", cell: (r) => (
              <div className="flex gap-2">
                <DialogButton label="Review payment" title={`Review ${r.receiptNo}`} icon={<Eye />}>
                  <PaymentReview r={{
                    receiptNo: r.receiptNo, clientName: r.clientName, clientCode: r.clientCode, quoteNumber: r.quoteNumber, salesOwner: r.salesOwner,
                    service: serviceOf.get(leadOfQuote.get(String(r.quoteId)) ?? "") ?? "", type: r.type, method: r.method, transactionId: r.transactionId, date: r.date,
                    amount: r.amount, quoteTotal: r.quoteTotal, paid: paidOf.get(String(r.quoteId)) ?? 0, approved: r.approval === "approved", proofUrl: proofOf.get(String(r.paymentId)) || undefined,
                  }} />
                  {r.approval !== "approved" && <div className="mt-5 flex justify-end"><ApprovalActions id={String(r._id)} client={r.clientName} /></div>}
                </DialogButton>
                {r.approval === "approved" && <PdfLink kind="receipt" id={String(r._id)} />}
                {r.approval !== "approved" && <ApprovalActions id={String(r._id)} client={r.clientName} />}
              </div>
            ) },
          ]}
        />
      )}
      {status !== "manual" && <Pagination page={page} total={total} query={{ q, status, from: range.from, to: range.to, seller: range.seller }} />}
    </>
  );
}
