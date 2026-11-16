import { DepartmentForm } from "@/components/hrms/forms";
import { EmptyState } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { AddLink, Panel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { connectDb } from "@/lib/db";
import { DEPARTMENT_KINDS } from "@/lib/hrms";
import { isId } from "@/lib/project-access";
import { param, type SearchParams } from "@/lib/pagination";
import { deleteDepartmentAction } from "@/server/hrms-actions";
import { Department, Employee } from "@/models/hrms";

export const metadata = { title: "HR · Departments" };

export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const edit = param(sp, "edit");
  const adding = param(sp, "new") === "1";
  await connectDb();
  const [rows, counts, editing] = await Promise.all([
    Department.find().select("name role").sort({ name: 1 }).limit(200).lean(),
    Employee.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$department", n: { $sum: 1 } } }]),
    isId(edit) ? Department.findById(edit).lean() : null,
  ]);
  const people = new Map(counts.map((c) => [String(c._id), c.n]));

  return (
    <>
      <div className="mb-4 flex justify-end"><AddLink href="?new=1">Add department</AddLink></div>
      {(adding || editing) && (
        <Panel title={editing ? "Edit department" : "Add department"} closeHref="/hrms/departments">
          <DepartmentForm values={editing ? { id: String(editing._id), name: editing.name, role: editing.role } : { name: "", role: "" }} />
        </Panel>
      )}
      {rows.length === 0 ? <EmptyState title="No departments yet" text="Add a department, then add an admin or a team member inside it." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Department", cell: (r) => r.name },
            { header: "Admin signs in as", cell: (r) => { const k = DEPARTMENT_KINDS.find((x) => x.role === r.role); return k ? `${k.label} (${k.prefix})` : r.role; } },
            { header: "People", cell: (r) => people.get(String(r._id)) ?? 0 },
            { header: "Actions", cell: (r) => <RowActions id={String(r._id)} editHref={`?edit=${r._id}`} remove={{ action: deleteDepartmentAction, title: "Delete this department?", text: "Departments that still have people cannot be deleted." }} /> },
          ]}
        />
      )}
    </>
  );
}
