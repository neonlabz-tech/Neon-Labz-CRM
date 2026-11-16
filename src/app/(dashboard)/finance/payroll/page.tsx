import { PayrollForm } from "@/components/finance/forms";
import { PeriodFilter } from "@/components/finance/period-filter";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { connectDb } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { periodRegex, PAY_STATUSES, readPeriod } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { isId } from "@/lib/project-access";
import { Payroll } from "@/models/finance";
import { Department, Employee } from "@/models/hrms";

export const metadata = { title: "Finance · Payroll" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { year, month, prefix } = readPeriod(sp, todayISO());
  const q = param(sp, "q");
  const status = param(sp, "status");
  const department = param(sp, "department");
  const page = pageOf(sp);
  const edit = param(sp, "edit");
  const adding = param(sp, "new") === "1";

  await connectDb();
  const departments = await Department.find().select("name").sort({ name: 1 }).lean();
  const people = await Employee.find().select("name username department").sort({ name: 1 }).limit(500).lean();

  const filter: Record<string, unknown> = {};
  if (prefix) filter.date = periodRegex(prefix);
  if (PAY_STATUSES.includes(status as never)) filter.status = status;
  if (q || isId(department)) {
    const rx = q ? new RegExp(escapeRegex(q), "i") : null;
    filter.employee = { $in: people.filter((p) => (!rx || rx.test(p.name) || rx.test(p.username)) && (!isId(department) || String(p.department) === department)).map((p) => p._id) };
  }

  const [rows, total, editing] = await Promise.all([
    Payroll.find(filter).select("employee date base commission status").sort({ date: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Payroll.countDocuments(filter),
    isId(edit) ? Payroll.findById(edit).lean() : null,
  ]);
  const dept = new Map(departments.map((d) => [String(d._id), d.name]));
  const who = new Map(people.map((p) => [String(p._id), p]));
  const options = people.map((p) => ({ id: String(p._id), label: `${p.name} · ${p.username}`, group: dept.get(String(p.department)) ?? "No department" }));

  return (
    <>
      <div className="mb-4 flex justify-end"><AddLink href="?new=1">Add payment</AddLink></div>
      {(adding || editing) && (
        <Panel title={editing ? "Edit payment" : "Add payment"} closeHref="/finance/payroll">
          <PayrollForm employees={options} values={editing ? { id: String(editing._id), employee: String(editing.employee), base: String(editing.base), commission: String(editing.commission), date: editing.date, status: editing.status } : { employee: "", base: "", commission: "0", date: todayISO(), status: "Non-paid" }} />
        </Panel>
      )}
      <PeriodFilter basePath="/finance/payroll" year={year} month={month} q={q} searchLabel="Employee name or login" extras={[
        { name: "department", label: "All departments", value: department, options: departments.map((d) => ({ value: String(d._id), label: d.name })) },
        { name: "status", label: "All statuses", value: status, options: PAY_STATUSES.map((s) => ({ value: s, label: s })) },
      ]} />
      {rows.length === 0 ? <EmptyState title="No payments for these filters" text="Change the period or add a payment." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Employee", cell: (r) => { const p = who.get(String(r.employee)); return <span>{p?.name ?? "Unknown"} <span className="font-normal text-muted">· {p?.username}</span></span>; } },
            { header: "Base amount", cell: (r) => formatMoney(r.base) },
            { header: "Commission", cell: (r) => formatMoney(r.commission) },
            { header: "Total", cell: (r) => formatMoney(r.base + r.commission) },
            { header: "Pay date", cell: (r) => r.date },
            { header: "Status", cell: (r) => <Badge tone={r.status === "Paid" ? "success" : "warning"}>{r.status}</Badge> },
            { header: "Actions", cell: (r) => <RowActions id={String(r._id)} editHref={`?edit=${r._id}`} /> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, status, department, year: year || "all", month: month || "all" }} />
    </>
  );
}
