import { Pencil, Plus } from "lucide-react";
import { IconLink } from "@/components/ui/icon-link";
import { PdfLink } from "@/components/ui/pdf-link";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { keepOwn, ownLeads, ownView, salesLeads } from "@/lib/own";
import { ownerScope } from "@/lib/permissions";
import { dateRange, readRange } from "@/lib/sales-range";
import { Badge } from "@/components/ui/badge";
import { Invoice } from "@/models/invoice";
import { Lead } from "@/models/lead";
import { User } from "@/models/user";
import { Quotation } from "@/models/quotation";
import { QuotationDeleteButton } from "@/components/quotations/quotation-delete-button";

export const metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("quotations.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const range = readRange(sp);
  const own = ownView(user.role, sp);

  await connectDb();
  // Converted clients, plus any lead that already has a quotation sent.
  const quotedIds = await Quotation.distinct("leadId", { ...ownerScope(user), ...(own ? { owner: user.username } : {}) });
  const and: Record<string, unknown>[] = [{ $or: [{ status: "Converted" }, { leadId: { $in: quotedIds } }] }];
  const filter: Record<string, unknown> = { $and: and, ...ownerScope(user), ...(own ? ownLeads(user.username) : user.role === "superadmin" ? salesLeads(user.username) : {}) };
  if (user.role === "superadmin" && !own && range.seller) filter.owner = range.seller;
  const created = dateRange(range);
  if (created) filter.createdAt = created;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    and.push({ $or: [{ business: rx }, { clientCode: rx }, { leadId: rx }] });
  }

  const sellers = user.role === "superadmin" && !own ? await User.find({ role: "sales" }).select("username fullName").sort({ username: 1 }).lean() : [];
  const [clients, total] = await Promise.all([
    Lead.find(filter).select("leadId business clientCode owner status").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Lead.countDocuments(filter),
  ]);
  const quotes = await Quotation.find({ leadId: { $in: clients.map((c) => c.leadId) } }).select("leadId number total valid items owner").lean();
  const paid = await Invoice.aggregate<{ _id: string; total: number }>([
    { $match: { quoteId: { $in: quotes.map((quote) => quote._id) }, approval: "approved" } },
    { $group: { _id: "$quoteId", total: { $sum: "$amount" } } },
  ]);
  const collected = new Map(paid.map((row) => [String(row._id), row.total]));
  const byLead = new Map(quotes.map((quote) => [quote.leadId, quote]));

  return (
    <>
      <PageHeader title="Quotations" subtitle={own ? "Quotations for your own leads and clients." : "One quotation per lead or client, built from your packages. Make one from a lead before it converts."} />
      <SearchBar q={q} keep={keepOwn(own)} placeholder="Search by client name or code" range={range} filters={sellers.length ? [{ name: "seller", label: "All salespeople", value: range.seller, options: sellers.map((u) => ({ value: u.username, label: u.fullName || u.username })) }] : []} />
      {clients.length === 0 ? (
        <EmptyState title="No quotations yet" text="Open a lead and choose Quotation, or mark a lead as Converted, and it will show up here." />
      ) : (
        <DataTable
          rows={clients}
          rowKey={(c) => c.leadId}
          columns={[
            { header: "Client ID", cell: (c) => (c.clientCode ? <span className="font-semibold text-brand-700">{c.clientCode}</span> : <span className="text-muted">Not converted</span>) },
            { header: "Client", cell: (c) => <span>{c.business} <span className="font-normal text-muted">· {c.leadId}</span></span> },
            { header: "Package", cell: (c) => byLead.get(c.leadId)?.items.map((item) => item.packageName).join(", ") || "—" },
            { header: "Quotation", cell: (c) => byLead.get(c.leadId)?.number ?? "Not made yet" },
            { header: "Total", cell: (c) => (byLead.has(c.leadId) ? formatMoney(byLead.get(c.leadId)!.total) : "—") },
            { header: "Collected", cell: (c) => (byLead.has(c.leadId) ? formatMoney(collected.get(String(byLead.get(c.leadId)!._id)) ?? 0) : "—") },
            { header: "Remaining", cell: (c) => { const quote = byLead.get(c.leadId); return quote ? formatMoney(Math.max(0, quote.total - (collected.get(String(quote._id)) ?? 0))) : "—"; } },
            { header: "Status", cell: (c) => { const quote = byLead.get(c.leadId); if (!quote) return <Badge tone="brand">No quotation</Badge>; const got = collected.get(String(quote._id)) ?? 0; return got >= quote.total ? <Badge tone="success">Paid</Badge> : got > 0 ? <Badge tone="warning">Part paid</Badge> : <Badge tone="info">Unpaid</Badge>; } },
            ...(user.role === "superadmin" ? [{ header: "Assigned to", cell: (c: (typeof clients)[number]) => c.owner }] : []),
            { header: "Valid until", cell: (c) => byLead.get(c.leadId)?.valid || "—" },
            {
              header: "Actions",
              cell: (c) => (
                <div className="flex gap-2">
                  {byLead.has(c.leadId) && <PdfLink kind="quotation" id={String(byLead.get(c.leadId)!._id)} />}
                  {byLead.has(c.leadId) && <QuotationDeleteButton id={String(byLead.get(c.leadId)!._id)} number={byLead.get(c.leadId)!.number} />}
                  <IconLink href={own ? `/quotations/${c.leadId}?own=1` : `/quotations/${c.leadId}`} label={byLead.has(c.leadId) ? "Edit quotation" : "Create quotation"}>{byLead.has(c.leadId) ? <Pencil /> : <Plus />}</IconLink>
                </div>
              ),
            },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, from: range.from, to: range.to, seller: range.seller, ...keepOwn(own) }} />
    </>
  );
}
