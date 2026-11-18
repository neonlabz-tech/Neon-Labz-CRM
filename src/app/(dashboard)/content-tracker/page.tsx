import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { visibleProjectFilter } from "@/lib/project-access";
import { ContentItem } from "@/models/content-track";
import { MarketingPlan } from "@/models/marketing-plan";
import { Project } from "@/models/project";

export const metadata = { title: "Content Tracker" };

/** The Marketing team's list of projects. Clicking one opens its content as a tracker table. */
export default async function ContentTrackerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("content.track");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter = { ...(await visibleProjectFilter(user)), type: { $in: ["marketing", "both"] }, archived: false, ...(rx ? { $or: [{ name: rx }, { code: rx }, { clientName: rx }] } : {}) };

  await connectDb();
  const [rows, total] = await Promise.all([
    Project.find(filter).select("code name clientCode clientName").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Project.countDocuments(filter),
  ]);
  const codes = rows.map((r) => r.code);
  const [plans, counts] = await Promise.all([
    MarketingPlan.find({ clientCode: { $in: rows.map((r) => r.clientCode) } }).select("clientCode months.posts").lean(),
    ContentItem.aggregate<{ _id: string; approved: number; published: number }>([
      { $match: { projectCode: { $in: codes } } },
      { $group: { _id: "$projectCode", approved: { $sum: { $cond: [{ $eq: ["$approval", "Approved"] }, 1, 0] } }, published: { $sum: { $cond: [{ $eq: ["$publishStatus", "Approved"] }, 1, 0] } } } },
    ]),
  ]);
  const planned = (clientCode: string) => plans.filter((p) => p.clientCode === clientCode).reduce((sum, p) => sum + p.months.reduce((n, m) => n + m.posts.length, 0), 0);
  const stat = (code: string) => counts.find((c) => c._id === code);

  return (
    <>
      <PageHeader title="Content Tracker" subtitle="Pick a project to see its planned content as a tracker." />
      <SearchBar q={q} placeholder="Search by project, code or client" />
      {rows.length === 0 ? <EmptyState title="No projects yet" text="Projects with a marketing part will appear here." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          rowHref={(r) => `/content-tracker/${r.code}`}
          columns={[
            { header: "Project", cell: (r) => <span><strong>{r.name}</strong><span className="block text-xs font-normal text-muted">{r.code}</span></span> },
            { header: "Client", cell: (r) => `${r.clientName} · ${r.clientCode}` },
            { header: "Planned posts", cell: (r) => planned(r.clientCode) },
            { header: "Approved", cell: (r) => stat(r.code)?.approved ?? 0 },
            { header: "Publish approved", cell: (r) => stat(r.code)?.published ?? 0 },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q }} />
    </>
  );
}
