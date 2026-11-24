import { EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddClientButton, ClientActions } from "@/components/special/row-actions";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { SPECIAL_TYPES, SpecialClient, SpecialDoc } from "@/models/special";

export const metadata = { title: "Special Clients" };

export default async function SpecialClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("special.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const type = param(sp, "type");
  const page = pageOf(sp);
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter: Record<string, unknown> = { ...(rx ? { $or: [{ name: rx }, { code: rx }, { contact: rx }, { email: rx }] } : {}), ...(SPECIAL_TYPES.includes(type as never) ? { type } : {}) };

  await connectDb();
  const [rows, total] = await Promise.all([
    SpecialClient.find(filter).sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    SpecialClient.countDocuments(filter),
  ]);
  const counts = await SpecialDoc.aggregate<{ _id: string; n: number }>([{ $match: { clientId: { $in: rows.map((r) => String(r._id)) } } }, { $group: { _id: "$clientId", n: { $sum: 1 } } }]);
  const docs = new Map(counts.map((c) => [c._id, c.n]));

  return (
    <>
      <PageHeader title="Special Clients" subtitle="Influencers, schools and other clients you handle directly. Use Send to give one to the PM or MD, who then start the project from Clients.">
        <AddClientButton />
      </PageHeader>
      <SearchBar q={q} placeholder="Search by name, code, contact or email" filters={[{ name: "type", label: "All types", value: type, options: SPECIAL_TYPES.map((t) => ({ value: t, label: t })) }]} />
      {rows.length === 0 ? <EmptyState title="No special clients yet" text="Add an influencer, a school or any client you handle directly." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Client", cell: (r) => <span>{r.name} <span className="font-normal text-muted">· {r.code}</span></span> },
            { header: "Type", cell: (r) => <Badge tone={r.type === "Influencer" ? "info" : r.type === "School" ? "success" : "brand"}>{r.type}</Badge> },
            { header: "Contact", cell: (r) => r.contact || "—" },
            { header: "Phone", cell: (r) => r.phone || "—" },
            { header: "Email", cell: (r) => r.email || "—" },
            { header: "Documents", cell: (r) => docs.get(String(r._id)) ?? 0 },
            { header: "Sent to", cell: (r) => ((r.sentTo ?? []).length ? <span className="flex gap-1">{(r.sentTo ?? []).map((role) => <Badge key={role} tone="info">{role === "pm" ? "PM" : "MD"}</Badge>)}</span> : "—") },
            { header: "Actions", cell: (r) => <ClientActions client={{ id: String(r._id), name: r.name, type: r.type, contact: r.contact, phone: r.phone, email: r.email, address: r.address }} /> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, type }} />
    </>
  );
}
