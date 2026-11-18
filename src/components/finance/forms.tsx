import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { AutoCommission } from "@/components/finance/auto-commission";
import { PAY_STATUSES } from "@/lib/finance";
import { addCategoryAction, saveExpenseAction, savePayrollAction, saveRevenueAction } from "@/server/finance-actions";

const Hidden = ({ id }: { id?: string }) => (id ? <input type="hidden" name="id" value={id} /> : null);
const grid = "grid gap-4 sm:grid-cols-2";

export function PayrollForm({ values, employees, logins }: {
  values: { id?: string; employee: string; base: string; commission: string; commissionMonth: string; date: string; status: string };
  employees: { id: string; label: string; group: string }[];
  /** Employee id to login, so a salesperson's earned commission can be filled in. */
  logins: Record<string, string>;
}) {
  const groups = [...new Set(employees.map((e) => e.group))];
  return (
    <ActionForm action={savePayrollAction} submit="Save payment" toastOnSuccess={false} className={grid}>
      <Hidden id={values.id} />
      <SelectField label="Employee" required name="employee" defaultValue={values.employee}>
        <option value="" disabled>{employees.length ? "Choose an employee" : "Add an employee in HR first"}</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {employees.filter((e) => e.group === g).map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </optgroup>
        ))}
      </SelectField>
      <Field label="Pay date" required name="date" type="date" defaultValue={values.date} />
      <Field label="Base amount (LKR)" required name="base" type="number" min="0" step="0.01" defaultValue={values.base} />
      <Field label="Commission month" name="commissionMonth" type="month" defaultValue={values.commissionMonth} />
      <AutoCommission logins={logins} defaultValue={values.commission} />
      <SelectField label="Status" required name="status" defaultValue={values.status}>{PAY_STATUSES.map((s) => <option key={s}>{s}</option>)}</SelectField>
    </ActionForm>
  );
}

export function ExpenseForm({ values, categories }: { values: { id?: string; date: string; category: string; description: string; amount: string }; categories: string[] }) {
  return (
    <ActionForm action={saveExpenseAction} submit="Save expense" toastOnSuccess={false} className={grid}>
      <Hidden id={values.id} />
      <Field label="Date" required name="date" type="date" defaultValue={values.date} />
      <SelectField label="Category" required name="category" defaultValue={values.category}>{categories.map((c) => <option key={c}>{c}</option>)}</SelectField>
      <Field label="Description" required name="description" defaultValue={values.description} maxLength={500} />
      <Field label="Amount (LKR)" required name="amount" type="number" min="0.01" step="0.01" defaultValue={values.amount} />
    </ActionForm>
  );
}

export function CategoryForm() {
  return (
    <ActionForm action={addCategoryAction} submit="Add category" toastOnSuccess={false} className="grid gap-4 sm:max-w-md">
      <Field label="Category name" required name="name" placeholder="e.g. Travel" maxLength={80} />
    </ActionForm>
  );
}

export function RevenueForm({ values, people }: { values: { id?: string; salesPerson: string; date: string; description: string; amount: string }; people: { username: string; name: string }[] }) {
  return (
    <ActionForm action={saveRevenueAction} submit="Save other revenue" toastOnSuccess={false} className={grid}>
      <Hidden id={values.id} />
      <SelectField label="Sales person" name="salesPerson" defaultValue={values.salesPerson}>
        <option value="">Other revenue</option>
        {people.map((p) => <option key={p.username} value={p.username}>{p.username} · {p.name}</option>)}
      </SelectField>
      <Field label="Collection date" required name="date" type="date" defaultValue={values.date} />
      <div className="sm:col-span-2"><TextareaField label="Description" required name="description" defaultValue={values.description} rows={2} maxLength={500} /></div>
      <Field label="Amount (LKR)" required name="amount" type="number" min="0.01" step="0.01" defaultValue={values.amount} />
    </ActionForm>
  );
}
