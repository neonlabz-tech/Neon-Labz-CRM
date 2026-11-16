import Link from "next/link";
import { Plus } from "lucide-react";
import { ReportRowActions } from "@/components/marketing/row-actions";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AccessBar } from "@/components/projects/access-bar";
import { keepOwn, ownView } from "@/lib/own";
import { requireAction } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PdfLink } from "@/components/ui/pdf-link";
import { connectDb } from "@/lib/db";
import { REPORT_PLATFORMS } from "@/lib/marketing";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { MarketingReport } from "@/models/marketing-report";
import { User } from "@/models/user";

export const metadata = { title: "Marketing reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("marketing.view");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const own = ownView(user.role, sp);
  const admin = user.role === "superadmin";
  const viewOnly = admin && !own;
  const md = param(sp, "md");
  const keep = { ...keepOwn(own), ...(md ? { md } : {}) };
  const manage = can(user.role, "marketing.manage") && !viewOnly;
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter = { ...(rx ? { $or: [{ clientName: rx }, { clientCode: rx }, { title: rx }] } : {}), ...(own ? { createdBy: user.username } : md ? { createdBy: md } : {}) };

  await connectDb();
  const [rows, total, accounts] = await Promise.all([
    MarketingReport.find(filter).select("clientCode clientName title startDate endDate platforms").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    MarketingReport.countDocuments(filter),
    viewOnly ? User.find({ role: "marketing" }).select("username fullName").sort({ username: 1 }).lean() : [],
  ]);
  const used = (r: (typeof rows)[number]) =>
    REPORT_PLATFORMS.filter(([key]) => Object.entries(r.platforms?.[key] ?? {}).some(([k, v]) => (k === "analysisImages" ? (v as string[]).length > 0 : Boolean(v)))).map(([, label]) => label).join(", ");

  return (
    <>
      {admin && <AccessBar own={own} pm={md} name="md" noun="marketing" path="/marketing/reports" accounts={accounts.map((a) => ({ username: a.username, label: a.fullName || a.username }))} />}
      <PageHeader title="Marketing reports" subtitle="Monthly social media results for each client.">
        {manage && (
          <Link prefetch={false} href="/marketing/reports/new" className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Create report</Link>
        )}
      </PageHeader>
      <SearchBar q={q} keep={keep} placeholder="Search by client name, ID or title" />
      {rows.length === 0 ? <EmptyState title="No reports yet" text="Create a report once a client has results to share." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Client", cell: (r) => r.clientName },
            { header: "ID", cell: (r) => <code>{r.clientCode}</code> },
            { header: "Period", cell: (r) => `${r.startDate} to ${r.endDate}` },
            { header: "Platforms", cell: (r) => used(r) || "—" },
            { header: "Actions", cell: (r) => (manage ? <ReportRowActions id={String(r._id)} /> : <PdfLink kind="report" id={String(r._id)} />) },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, ...keep }} />
    </>
  );
}
