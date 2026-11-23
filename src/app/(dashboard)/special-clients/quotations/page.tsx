import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddQuoteButton, QuoteActions } from "@/components/special/row-actions";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { addDays, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { clientOptions } from "@/lib/special";
import { quoteScope, richToHtml } from "@/lib/rich-text";
import { formatDay } from "@/lib/utils";
import { Package } from "@/models/package";
import { SpecialDoc } from "@/models/special";

export const metadata = { title: "Special Clients · Quotations" };

export default async function SpecialQuotationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("special.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter: Record<string, unknown> = { kind: "quotation", ...(rx ? { $or: [{ number: rx }, { clientName: rx }] } : {}) };

  await connectDb();
  const [rows, total, clients, pkgs] = await Promise.all([
    SpecialDoc.find(filter).sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    SpecialDoc.countDocuments(filter),
    clientOptions(),
    Package.find({ status: "active" }).select("name price description features included summary").sort({ name: 1 }).lean(),
  ]);
  const packages = pkgs.map((p) => ({ id: String(p._id), name: p.name, price: p.price, ...quoteScope(p) }));
  const today = todayISO();
  const fresh = { date: today, valid: addDays(today, 14), discount: 0, terms: "", lines: [] };

  return (
    <>
      <PageHeader title="Quotations" subtitle="Quotations for special clients. Every one can be edited, deleted and downloaded as a PDF.">
        {clients.length > 0 && <AddQuoteButton clients={clients} packages={packages} defaults={fresh} />}
      </PageHeader>
      <SearchBar q={q} placeholder="Search by number or client" />
      {rows.length === 0 ? (
        <EmptyState title="No quotations yet" text={clients.length ? "Create the first quotation for a special client." : "Add a special client first (Clients tab), then create their quotation here."} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Number", cell: (r) => r.number },
            { header: "Client", cell: (r) => r.clientName },
            { header: "Date", cell: (r) => formatDay(r.date) },
            { header: "Valid until", cell: (r) => (r.valid ? formatDay(r.valid) : "—") },
            { header: "Items", cell: (r) => r.items.length },
            { header: "Total", cell: (r) => formatMoney(r.total) },
            {
              header: "Actions",
              cell: (r) => (
                <QuoteActions
                  id={String(r._id)}
                  number={r.number}
                  clients={clients}
                  packages={packages}
                  defaults={{ clientId: r.clientId, date: r.date, valid: r.valid ?? "", discount: r.discountPercent, terms: r.body, lines: r.items.map((i) => ({ name: i.name, price: String(i.price), scope: richToHtml(i.scope ?? "") })) }}
                />
              ),
            },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q }} />
    </>
  );
}
