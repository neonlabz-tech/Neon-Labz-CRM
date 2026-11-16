import { ActivityForm } from "@/components/hrms/forms";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { connectDb } from "@/lib/db";
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUSES } from "@/lib/hrms";
import { isId } from "@/lib/project-access";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { deleteActivityAction } from "@/server/hrms-actions";
import { Activity } from "@/models/hrms";

export const metadata = { title: "HR · Activities" };

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = param(sp, "q");
  const category = param(sp, "category");
  const status = param(sp, "status");
  const page = pageOf(sp);
  const edit = param(sp, "edit");
  const adding = param(sp, "new") === "1";

  const filter: Record<string, unknown> = {};
  if (ACTIVITY_CATEGORIES.includes(category as never)) filter.category = category;
  if (ACTIVITY_STATUSES.includes(status as never)) filter.status = status;
  if (q) { const rx = new RegExp(escapeRegex(q), "i"); filter.$or = [{ name: rx }, { description: rx }]; }

  await connectDb();
  const [rows, total, editing] = await Promise.all([
    Activity.find(filter).select("name category date description status").sort({ date: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Activity.countDocuments(filter),
    isId(edit) ? Activity.findById(edit).lean() : null,
  ]);

  return (
    <>
      <div className="mb-4 flex justify-end"><AddLink href="?new=1">Add activity</AddLink></div>
      {(adding || editing) && (
        <Panel title={editing ? "Edit activity" : "Add activity"} closeHref="/hrms/activities">
          <ActivityForm values={editing ? { id: String(editing._id), name: editing.name, category: editing.category, date: editing.date, status: editing.status, description: editing.description } : { name: "", category: ACTIVITY_CATEGORIES[1], date: "", status: "Scheduled", description: "" }} />
        </Panel>
      )}
      <SearchBar q={q} placeholder="Search activities" filters={[
        { name: "category", label: "All categories", value: category, options: ACTIVITY_CATEGORIES.map((c) => ({ value: c, label: c })) },
        { name: "status", label: "All statuses", value: status, options: ACTIVITY_STATUSES.map((s) => ({ value: s, label: s })) },
      ]} />
      {rows.length === 0 ? <EmptyState title="No activities yet" text="Schedule a team event to see it here." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Activity", cell: (r) => r.name },
            { header: "Category", cell: (r) => r.category },
            { header: "Date", cell: (r) => r.date },
            { header: "Description", cell: (r) => r.description },
            { header: "Status", cell: (r) => <Badge tone={r.status === "Completed" ? "success" : "info"}>{r.status}</Badge> },
            { header: "Actions", cell: (r) => <RowActions id={String(r._id)} editHref={`?edit=${r._id}`} remove={{ action: deleteActivityAction, title: "Delete this activity?", text: "This cannot be undone." }} /> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, category, status }} />
    </>
  );
}
