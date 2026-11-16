import Link from "next/link";
import { Plus } from "lucide-react";
import { PlanRowActions } from "@/components/marketing/row-actions";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AccessBar } from "@/components/projects/access-bar";
import { keepOwn, ownView } from "@/lib/own";
import { requireAction } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PdfLink } from "@/components/ui/pdf-link";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { MarketingPlan } from "@/models/marketing-plan";
import { User } from "@/models/user";

export const metadata = { title: "Content plans" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
  const filter = { ...(rx ? { $or: [{ title: rx }, { clientName: rx }, { clientCode: rx }] } : {}), ...(own ? { createdBy: user.username } : md ? { createdBy: md } : {}) };

  await connectDb();
  const [rows, total, accounts] = await Promise.all([
    MarketingPlan.find(filter).select("title clientName clientCode startDate endDate updatedAt months.posts.status").sort({ updatedAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    MarketingPlan.countDocuments(filter),
    viewOnly ? User.find({ role: "marketing" }).select("username fullName").sort({ username: 1 }).lean() : [],
  ]);

  return (
    <>
      {admin && <AccessBar own={own} pm={md} name="md" noun="marketing" path="/marketing/plans" accounts={accounts.map((a) => ({ username: a.username, label: a.fullName || a.username }))} />}
      <PageHeader title="Content plans" subtitle="Monthly posting plans for each client.">
        {manage && (
          <Link prefetch={false} href="/marketing/plans/new" className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New plan</Link>
        )}
      </PageHeader>
      <SearchBar q={q} keep={keep} placeholder="Search by title or client" />
      {rows.length === 0 ? <EmptyState title="No content plans yet" text="Create a plan to schedule posts for a client." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Plan", cell: (r) => r.title },
            { header: "Client", cell: (r) => `${r.clientName} · ${r.clientCode}` },
            { header: "Period", cell: (r) => (r.startDate ? `${r.startDate} to ${r.endDate || "…"}` : "—") },
            { header: "Progress", cell: (r) => {
              const posts = r.months.flatMap((m) => m.posts);
              const done = posts.filter((p) => p.status === "Completed").length;
              return posts.length === 0 ? "—" : done === posts.length ? <Badge tone="success">Completed · {done}/{posts.length}</Badge> : <span>{done}/{posts.length} posted</span>;
            } },
            { header: "Updated", cell: (r) => formatDateTime(r.updatedAt) },
            { header: "Actions", cell: (r) => (manage ? <PlanRowActions id={String(r._id)} /> : <PdfLink kind="plan" id={String(r._id)} />) },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, ...keep }} />
    </>
  );
}
