import { LeaveForm } from "@/components/hrms/forms";
import { EmptyState } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { connectDb } from "@/lib/db";
import { LEAVE_TYPES } from "@/lib/hrms";
import { isId } from "@/lib/project-access";
import { pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { deleteLeaveAction } from "@/server/hrms-actions";
import { Employee, Leave } from "@/models/hrms";

export const metadata = { title: "HR · Leave" };

export default async function LeavesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const employee = param(sp, "employee");
  const type = param(sp, "type");
  const page = pageOf(sp);
  const edit = param(sp, "edit");
  const adding = param(sp, "new") === "1";

  const filter: Record<string, unknown> = {};
  if (isId(employee)) filter.employee = employee;
  if (LEAVE_TYPES.includes(type as never)) filter.type = type;

  await connectDb();
  const [people, rows, total, editing] = await Promise.all([
    Employee.find().select("name username").sort({ name: 1 }).limit(500).lean(),
    Leave.find(filter).select("employee date type description").sort({ date: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Leave.countDocuments(filter),
    isId(edit) ? Leave.findById(edit).lean() : null,
  ]);
  const options = people.map((p) => ({ id: String(p._id), name: `${p.name} · ${p.username}` }));
  const nameOf = new Map(options.map((o) => [o.id, o.name]));

  return (
    <>
      <div className="mb-4 flex justify-end"><AddLink href="?new=1">Add leave</AddLink></div>
      {(adding || editing) && (
        <Panel title={editing ? "Edit leave" : "Add leave"} closeHref="/hrms/leaves">
          <LeaveForm employees={options} values={editing ? { id: String(editing._id), employee: String(editing.employee), date: editing.date, type: editing.type, description: editing.description } : { employee: "", date: "", type: LEAVE_TYPES[0], description: "" }} />
        </Panel>
      )}
      <SearchBar q="" placeholder="Filter leave records" filters={[
        { name: "employee", label: "All employees", value: employee, options: options.map((o) => ({ value: o.id, label: o.name })) },
        { name: "type", label: "All types", value: type, options: LEAVE_TYPES.map((t) => ({ value: t, label: t })) },
      ]} />
      {rows.length === 0 ? <EmptyState title="No leave records" text="Leave you record will appear here." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Employee", cell: (r) => nameOf.get(String(r.employee)) ?? "Unknown" },
            { header: "Leave date", cell: (r) => r.date },
            { header: "Type", cell: (r) => r.type },
            { header: "Description", cell: (r) => r.description },
            { header: "Actions", cell: (r) => <RowActions id={String(r._id)} editHref={`?edit=${r._id}`} remove={{ action: deleteLeaveAction, title: "Delete this leave record?", text: "This cannot be undone." }} /> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ employee, type }} />
    </>
  );
}
