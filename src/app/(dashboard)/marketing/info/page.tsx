import Link from "next/link";
import { Plus } from "lucide-react";
import { InfoRowActions } from "@/components/marketing/row-actions";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AccessBar } from "@/components/projects/access-bar";
import { keepOwn, ownView } from "@/lib/own";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { formatDateTime } from "@/lib/utils";
import { MarketingInfo } from "@/models/marketing-info";
import { User } from "@/models/user";

export const metadata = { title: "Client info" };

export default async function InfoListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("marketing.view");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const own = ownView(user.role, sp);
  const admin = user.role === "superadmin";
  const viewOnly = admin && !own;
  // Project managers can read the info document (without saved passwords) but cannot add, edit or delete it.
  const glance = user.role === "pm";
  const md = param(sp, "md");
  const keep = { ...keepOwn(own), ...(md ? { md } : {}) };
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter = { ...(rx ? { $or: [{ clientName: rx }, { clientCode: rx }, { brandName: rx }] } : {}), ...(own ? { createdBy: user.username } : md ? { createdBy: md } : {}) };

  await connectDb();
  const [rows, total, accounts] = await Promise.all([
    MarketingInfo.find(filter).select("clientCode clientName brandName industry updatedAt").sort({ updatedAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    MarketingInfo.countDocuments(filter),
    viewOnly ? User.find({ role: "marketing" }).select("username fullName").sort({ username: 1 }).lean() : [],
  ]);

  return (
    <>
      {admin && <AccessBar own={own} pm={md} name="md" noun="marketing" path="/marketing/info" accounts={accounts.map((a) => ({ username: a.username, label: a.fullName || a.username }))} />}
      <PageHeader title="Client info" subtitle="Brand details and social accounts for each client.">
        {!viewOnly && !glance && <Link prefetch={false} href={own ? "/marketing/info/new?own=1" : "/marketing/info/new"} className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add client info</Link>}
      </PageHeader>
      <SearchBar q={q} keep={keep} placeholder="Search by client, code or brand" />
      {rows.length === 0 ? <EmptyState title="No client info yet" text="Add the brand details once a client is ready for marketing." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.clientCode}
          columns={[
            { header: "Client", cell: (r) => <span>{r.clientName} <span className="font-normal text-muted">· {r.clientCode}</span></span> },
            { header: "Brand", cell: (r) => r.brandName || "—" },
            { header: "Industry", cell: (r) => r.industry || "—" },
            { header: "Updated", cell: (r) => formatDateTime(r.updatedAt) },
            { header: "Actions", cell: (r) => <InfoRowActions clientCode={r.clientCode} readOnly={viewOnly || glance} /> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, ...keep }} />
    </>
  );
}
