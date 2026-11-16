import { CategoryForm, ExpenseForm } from "@/components/finance/forms";
import { PeriodFilter } from "@/components/finance/period-filter";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, Stat } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { connectDb } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { DEFAULT_CATEGORIES, monthLabel, periodRegex, dateRange, readPeriod } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { isId } from "@/lib/project-access";
import { deleteExpenseAction } from "@/server/finance-actions";
import { Expense, ExpenseCategory, Payroll } from "@/models/finance";
import { Wallet } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Finance · Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const period = readPeriod(sp, todayISO());
  const { year, month, prefix, from, to } = period;
  const q = param(sp, "q");
  const category = param(sp, "category");
  const page = pageOf(sp);
  const edit = param(sp, "edit");
  const adding = param(sp, "new") === "1";
  const addingCategory = param(sp, "category-new") === "1";

  await connectDb();
  const custom = (await ExpenseCategory.find().select("name").sort({ name: 1 }).lean()).map((c) => c.name);
  const categories = [...new Map([...DEFAULT_CATEGORIES, ...custom].map((c) => [c.trim().toLowerCase(), c])).values()];

  const filter: Record<string, unknown> = {};
  if (prefix || from || to) filter.date = dateRange(period);
  if (categories.includes(category)) filter.category = category;
  if (q) { const rx = new RegExp(escapeRegex(q), "i"); filter.$or = [{ description: rx }, { category: rx }]; }

  const showSalary = !category || category === "Salary";
  const [rows, total, sum, salary, editing] = await Promise.all([
    Expense.find(filter).select("date category description amount").sort({ date: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate<{ total: number }>([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    showSalary
      ? Payroll.aggregate<{ _id: string; amount: number; date: string }>([
          { $match: { status: "Paid", ...(prefix || from || to ? { date: dateRange(period) } : {}) } },
          { $group: { _id: "$month", amount: { $sum: { $add: ["$base", "$commission"] } }, date: { $max: "$date" } } },
          { $sort: { _id: -1 } },
        ])
      : [],
    isId(edit) ? Expense.findById(edit).lean() : null,
  ]);
  const payrollTotal = salary.reduce((s, r) => s + r.amount, 0);
  const grand = (sum[0]?.total ?? 0) + payrollTotal;

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Stat label="Total expenses" value={formatMoney(grand)} hint={`${formatMoney(payrollTotal)} of this is paid salary`} icon={<Wallet className="h-5 w-5" />} />
        <div className="flex flex-wrap items-center justify-end gap-2 sm:self-center">
          <Link prefetch={false} href="?category-new=1" className="inline-flex h-11 items-center rounded-xl border border-line px-5 text-sm font-semibold hover:bg-brand-50">Add category</Link>
          <AddLink href="?new=1">Add expense</AddLink>
        </div>
      </div>
      {addingCategory && <Panel title="Add category" closeHref="/finance/expenses"><CategoryForm /></Panel>}
      {(adding || editing) && (
        <Panel title={editing ? "Edit expense" : "Add expense"} closeHref="/finance/expenses">
          <ExpenseForm categories={categories} values={editing ? { id: String(editing._id), date: editing.date, category: editing.category, description: editing.description, amount: String(editing.amount) } : { date: todayISO(), category: categories[0] ?? "", description: "", amount: "" }} />
        </Panel>
      )}
      <PeriodFilter basePath="/finance/expenses" year={year} month={month} range={{ from, to }} q={q} searchLabel="Description or category" extras={[
        { name: "category", label: "All categories", value: category, options: ["Salary", ...categories].map((c) => ({ value: c, label: c })) },
      ]} />
      {salary.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 font-semibold">Salary from payroll</h2>
          <ul className="divide-y divide-line text-sm">
            {salary.map((s) => (
              <li key={s._id} className="flex items-center justify-between gap-3 py-2">
                <span>Payroll total · {monthLabel(s._id)} <Badge tone="info">Auto</Badge></span>
                <strong>{formatMoney(s.amount)}</strong>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {rows.length === 0 ? <EmptyState title="No expenses for these filters" text="Change the period or add an expense." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Date", cell: (r) => r.date },
            { header: "Category", cell: (r) => r.category },
            { header: "Description", cell: (r) => r.description || "—" },
            { header: "Amount", cell: (r) => formatMoney(r.amount) },
            { header: "Actions", cell: (r) => <RowActions id={String(r._id)} editHref={`?edit=${r._id}`} remove={{ action: deleteExpenseAction, title: "Delete this expense?", text: "The salary rows that come from payroll stay." }} /> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, category, year: year || "all", month: month || "all", from, to }} />
    </>
  );
}
