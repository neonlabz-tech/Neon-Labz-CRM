import { EmployeeForm } from "@/components/hrms/forms";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { connectDb } from "@/lib/db";
import { EMPLOYMENT_STATUSES } from "@/lib/hrms";
import { isId } from "@/lib/project-access";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { formatPhone } from "@/lib/phone";
import { deleteEmployeeAction } from "@/server/hrms-actions";
import { Department, Employee } from "@/models/hrms";

export const metadata = { title: "HR · Employees" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = param(sp, "q");
  const status = param(sp, "status");
  const department = param(sp, "department");
  const page = pageOf(sp);
  const edit = param(sp, "edit");
  const adding = param(sp, "new") === "1";

  const filter: Record<string, unknown> = {};
  if (EMPLOYMENT_STATUSES.includes(status as never)) filter.status = status;
  if (isId(department)) filter.department = department;
  if (q) { const rx = new RegExp(escapeRegex(q), "i"); filter.$or = [{ name: rx }, { email: rx }, { username: rx }]; }

  await connectDb();
  const [departments, rows, total, editing] = await Promise.all([
    Department.find().select("name").sort({ name: 1 }).lean(),
    Employee.find(filter).select("username name email phone join title status memberType department").sort({ name: 1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Employee.countDocuments(filter),
    isId(edit) ? Employee.findById(edit).lean() : null,
  ]);
  const options = departments.map((d) => ({ id: String(d._id), name: d.name }));
  const nameOf = new Map(options.map((d) => [d.id, d.name]));
  const known = ["Intern", "Trainee", "Junior", "Associate", "Senior", "Manager"];

  return (
    <>
      <div className="mb-4 flex justify-end"><AddLink href="?new=1">Add employee</AddLink></div>
      {(adding || editing) && (
        <Panel title={editing ? "Edit employee" : "Add employee"} closeHref="/hrms">
          <EmployeeForm
            departments={options}
            values={editing ? {
              id: String(editing._id), name: editing.name, email: editing.email, phone: editing.phone, join: editing.join,
              role: known.includes(editing.title) ? editing.title : "Custom Role", customRole: known.includes(editing.title) ? "" : editing.title,
              status: editing.status, department: String(editing.department), memberType: editing.memberType,
            } : { name: "", email: "", phone: "", join: "", role: "Intern", customRole: "", status: "Active", department: "", memberType: "team" }}
          />
        </Panel>
      )}
      <SearchBar q={q} placeholder="Search by name, email or login" filters={[
        { name: "department", label: "All departments", value: department, options: options.map((d) => ({ value: d.id, label: d.name })) },
        { name: "status", label: "All statuses", value: status, options: EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: s })) },
      ]} />
      {rows.length === 0 ? <EmptyState title="No employees yet" text="Add a department first, then add the people in it." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Employee", cell: (r) => <span>{r.name} <span className="font-normal text-muted">· {r.username}</span></span> },
            { header: "Department", cell: (r) => nameOf.get(String(r.department)) ?? "—" },
            { header: "Role", cell: (r) => `${r.title} · ${r.memberType === "admin" ? "Admin" : "Team"}` },
            { header: "Contact", cell: (r) => <span>{r.email}<br /><span className="text-muted">{formatPhone(r.phone)}</span></span> },
            { header: "Joined", cell: (r) => r.join },
            { header: "Status", cell: (r) => <Badge tone={r.status === "Active" ? "success" : "danger"}>{r.status}</Badge> },
            { header: "Actions", cell: (r) => <RowActions id={String(r._id)} editHref={`?edit=${r._id}`} remove={{ action: deleteEmployeeAction, title: "Delete this employee?", text: "Their login is removed too. People with leave or payroll records cannot be deleted; change the status instead." }} /> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, status, department }} />
    </>
  );
}
