import Link from "next/link";
import { PdfLink } from "@/components/ui/pdf-link";
import { Download, Eye, Plus } from "lucide-react";
import { DialogButton } from "@/components/ui/dialog-button";
import { SlipView } from "@/components/sales/payment-review";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { keepOwn } from "@/lib/own";
import { requireAction } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { connectDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { Invoice } from "@/models/invoice";
import { Payment } from "@/models/payment";

export const metadata = { title: "Payments" };

const label = { pending: "Waiting for approval", confirmed: "Approved", cancelled: "Cancelled" } as const;
const tone = { pending: "warning", confirmed: "success", cancelled: "danger" } as const;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("payments.record");
  const sp = await searchParams;
  const q = param(sp, "q");
  const status = param(sp, "status");
  const page = pageOf(sp);

  const filter: Record<string, unknown> = { owner: user.username };
  if (status in label) filter.status = status;
  await connectDb();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const byReceipt = await Invoice.find({ salesOwner: user.username, receiptNo: rx }).select("paymentId").limit(200).lean();
    filter.$or = [{ clientName: rx }, { saleCode: rx }, { clientCode: rx }, { _id: { $in: byReceipt.map((i) => i.paymentId) } }];
  }

  const [rows, total] = await Promise.all([
    Payment.find(filter).select("saleCode clientName clientCode amount date type status method transactionId proofUrl").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Payment.countDocuments(filter),
  ]);
  const invoices = await Invoice.find({ paymentId: { $in: rows.map((r) => r._id) } }).select("paymentId receiptNo").lean();
  const receipt = new Map(invoices.map((i) => [String(i.paymentId), { no: i.receiptNo, id: String(i._id) }]));

  return (
    <>
      <PageHeader title="Payments" subtitle={user.role === "superadmin" ? "Payments for your own projects. They are approved as you save them." : "Record what a client paid. The Super Admin approves each payment."}>
        <div className="flex flex-wrap gap-2">
          {can(user.role, "payments.export") && <a href={`/payments/export?${new URLSearchParams({ q, status })}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-brand-50"><Download className="h-4 w-4" />Export CSV</a>}
          <Link prefetch={false} href={user.role === "superadmin" ? "/payments/new?own=1" : "/payments/new"} className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Record payment</Link>
      </div>
      </PageHeader>
      <SearchBar q={q} keep={keepOwn(user.role === "superadmin")} placeholder="Search by client, receipt or sale ID" filters={[{ name: "status", label: "All statuses", value: status, options: Object.entries(label).map(([value, text]) => ({ value, label: text })) }]} />
      {rows.length === 0 ? (
        <EmptyState title="No payments yet" text="Record a payment once a client has paid." />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Client", cell: (r) => <span>{r.clientName} <span className="font-normal text-muted">· {r.clientCode}</span></span> },
            { header: "Receipt", cell: (r) => receipt.get(String(r._id))?.no ?? "—" },
            { header: "Sale ID", cell: (r) => r.saleCode },
            { header: "Type", cell: (r) => r.type },
            { header: "Amount", cell: (r) => formatMoney(r.amount) },
            { header: "Date", cell: (r) => r.date },
            { header: "Status", cell: (r) => <Badge tone={tone[r.status]}>{label[r.status]}</Badge> },
            { header: "Details", cell: (r) => (
              <DialogButton label="View payment" title={`${r.clientName} · ${r.saleCode}`} subtitle={`${formatMoney(r.amount)} · ${r.date}`} icon={<Eye />}>
                <dl className="mb-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {([["Payment type", r.type], ["Method", r.method || "—"], ["Transaction no.", r.transactionId || "—"], ["Status", label[r.status]]] as const).map(([k, v]) => (
                    <div key={k} className="border-b border-line pb-2"><dt className="text-xs text-muted">{k}</dt><dd className="text-sm font-semibold">{v}</dd></div>
                  ))}
                </dl>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Receipt / slip</h3>
                <SlipView url={r.proofUrl || undefined} />
              </DialogButton>
            ) },
            { header: "Receipt PDF", cell: (r) => (receipt.has(String(r._id)) ? <PdfLink kind="receipt" id={receipt.get(String(r._id))!.id} /> : "—") },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, status, ...keepOwn(user.role === "superadmin") }} />
    </>
  );
}
