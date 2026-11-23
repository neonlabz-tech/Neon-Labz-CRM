import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddInfoButton, InfoActions } from "@/components/special/row-actions";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { SOCIALS } from "@/lib/marketing";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { stringsOf } from "@/lib/special";
import { formatDateTime } from "@/lib/utils";
import { SpecialClient } from "@/models/special";

export const metadata = { title: "Special Clients · Client info" };

export default async function SpecialInfoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("special.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter: Record<string, unknown> = { infoSaved: true, ...(rx ? { $or: [{ name: rx }, { code: rx }, { "info.brandName": rx }] } : {}) };

  await connectDb();
  const [rows, total, all] = await Promise.all([
    SpecialClient.find(filter).sort({ updatedAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    SpecialClient.countDocuments(filter),
    SpecialClient.find({ infoSaved: { $ne: true } }).select("name code").sort({ name: 1 }).lean(),
  ]);
  const without = all.map((c) => ({ id: String(c._id), name: c.name, code: c.code }));

  return (
    <>
      <PageHeader title="Client info" subtitle="Brand details, contacts and social accounts for each special client (the same form the marketing team uses).">
        {without.length > 0 && <AddInfoButton clients={without} />}
      </PageHeader>
      <SearchBar q={q} placeholder="Search by client, code or brand" />
      {rows.length === 0 ? (
        <EmptyState title="No client info yet" text={without.length ? "Add the brand details and social accounts of a special client." : "Add a special client first (Clients tab)."} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Client", cell: (r) => <span>{r.name} <span className="font-normal text-muted">· {r.code}</span></span> },
            { header: "Brand", cell: (r) => stringsOf(r.info).brandName || "—" },
            { header: "Industry", cell: (r) => stringsOf(r.info).industry || "—" },
            { header: "Updated", cell: (r) => formatDateTime(r.updatedAt) },
            {
              header: "Actions",
              cell: (r) => {
                const info = (r.info ?? {}) as Record<string, unknown> & { social?: Record<string, { username?: string; pageLink?: string; password?: string }> };
                const stored = info.social ?? {};
                const social = Object.fromEntries(SOCIALS.map((key) => [key, { username: stored[key]?.username ?? "", pageLink: stored[key]?.pageLink ?? "", hasPassword: Boolean(stored[key]?.password) }]));
                return <InfoActions id={String(r._id)} name={r.name} values={stringsOf(info)} social={social} />;
              },
            },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q }} />
    </>
  );
}
