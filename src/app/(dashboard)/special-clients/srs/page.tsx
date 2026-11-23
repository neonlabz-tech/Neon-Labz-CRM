import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddSrsButton, SrsActions } from "@/components/special/row-actions";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { clientOptions, stringsOf } from "@/lib/special";
import { formatDay } from "@/lib/utils";
import { SpecialDoc } from "@/models/special";

export const metadata = { title: "Special Clients · SRS documents" };

export default async function SpecialSrsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("special.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter: Record<string, unknown> = { kind: "srs", ...(rx ? { $or: [{ number: rx }, { clientName: rx }, { title: rx }] } : {}) };

  await connectDb();
  const [rows, total, clients] = await Promise.all([
    SpecialDoc.find(filter).sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    SpecialDoc.countDocuments(filter),
    clientOptions(),
  ]);

  return (
    <>
      <PageHeader title="SRS documents" subtitle="The same SRS form the project reports use. Every one can be edited, deleted and downloaded as a PDF.">
        {clients.length > 0 && <AddSrsButton clients={clients} today={todayISO()} />}
      </PageHeader>
      <SearchBar q={q} placeholder="Search by number, client or title" />
      {rows.length === 0 ? (
        <EmptyState title="Nothing here yet" text={clients.length ? "Create the first SRS document for a special client." : "Add a special client first (Clients tab), then create their SRS document here."} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Number", cell: (r) => r.number },
            { header: "Title", cell: (r) => r.title },
            { header: "Client", cell: (r) => r.clientName },
            { header: "Date", cell: (r) => formatDay(r.date) },
            { header: "Actions", cell: (r) => <SrsActions id={String(r._id)} number={r.number} clientId={r.clientId} clients={clients} values={{ ...stringsOf(r.data), title: r.title, date: r.date }} /> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q }} />
    </>
  );
}
