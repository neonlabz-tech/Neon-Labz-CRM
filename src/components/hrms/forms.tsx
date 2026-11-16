import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUSES, DEPARTMENT_KINDS, EMPLOYMENT_STATUSES, HR_ROLES, LEAVE_TYPES, MEMBER_TYPES } from "@/lib/hrms";
import { saveActivityAction, saveDepartmentAction, saveEmployeeAction, saveLeaveAction } from "@/server/hrms-actions";
import { PasswordField } from "@/components/auth/password-field";

type Option = { id: string; name: string };
const Hidden = ({ id }: { id?: string }) => (id ? <input type="hidden" name="id" value={id} /> : null);
const grid = "grid gap-4 sm:grid-cols-2";

export function DepartmentForm({ values }: { values: { id?: string; name: string; role: string } }) {
  return (
    <ActionForm action={saveDepartmentAction} submit="Save department" toastOnSuccess={false} className={`${grid} sm:items-end`}>
      <Hidden id={values.id} />
      <Field label="Department name" required name="name" defaultValue={values.name} maxLength={80} />
      <SelectField label="Admin signs in as" required name="role" defaultValue={values.role}>
        <option value="" disabled>Choose a type</option>
        {DEPARTMENT_KINDS.map((k) => <option key={k.role} value={k.role}>{k.label} ({k.prefix})</option>)}
      </SelectField>
    </ActionForm>
  );
}

export type EmployeeValues = { id?: string; name: string; email: string; phone: string; join: string; role: string; customRole: string; status: string; department: string; memberType: string };

export function EmployeeForm({ values, departments }: { values: EmployeeValues; departments: Option[] }) {
  const editing = Boolean(values.id);
  return (
    <ActionForm action={saveEmployeeAction} submit="Save employee" toastOnSuccess={false} className={grid}>
      <Hidden id={values.id} />
      <Field label="Full name" required name="name" defaultValue={values.name} maxLength={200} />
      <Field label="Email address" required name="email" type="email" defaultValue={values.email} />
      <Field label="Phone number" required name="phone" type="tel" inputMode="tel" placeholder="077-123-4567" defaultValue={values.phone} />
      <Field label="Joining date" required name="join" type="date" defaultValue={values.join} />
      <SelectField label="Role" required name="role" defaultValue={values.role}>{HR_ROLES.map((r) => <option key={r}>{r}</option>)}</SelectField>
      <Field label="Custom role title" name="customRole" defaultValue={values.customRole} placeholder="Only if the role is Custom Role" />
      <SelectField label="Employment status" required name="status" defaultValue={values.status}>{EMPLOYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</SelectField>
      {editing ? (
        <>
          <input type="hidden" name="department" value={values.department} />
          <input type="hidden" name="memberType" value={values.memberType} />
          <p className="self-end text-sm text-muted">Department: <strong className="text-ink">{departments.find((d) => d.id === values.department)?.name}</strong> · {MEMBER_TYPES.find((m) => m.id === values.memberType)?.label}. These stay fixed because the login depends on them.</p>
        </>
      ) : (
        <>
          <SelectField label="Department" required name="department" defaultValue="">
            <option value="" disabled>{departments.length ? "Choose a department" : "Add a department first"}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <SelectField label="Access" required name="memberType" defaultValue={values.memberType}>{MEMBER_TYPES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</SelectField>
        </>
      )}
      <PasswordField label={editing ? "New password (optional)" : "Temporary password"} required={!editing} name="password" autoComplete="new-password" />
      <PasswordField label="Confirm password" required={!editing} name="confirm" autoComplete="new-password" />
    </ActionForm>
  );
}

export function LeaveForm({ values, employees }: { values: { id?: string; employee: string; date: string; type: string; description: string }; employees: Option[] }) {
  return (
    <ActionForm action={saveLeaveAction} submit="Save leave" toastOnSuccess={false} className={grid}>
      <Hidden id={values.id} />
      <SelectField label="Employee" required name="employee" defaultValue={values.employee}>
        <option value="" disabled>Choose an employee</option>
        {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </SelectField>
      <Field label="Leave date" required name="date" type="date" defaultValue={values.date} />
      <SelectField label="Leave type" required name="type" defaultValue={values.type}>{LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}</SelectField>
      <div className="sm:col-span-2"><TextareaField label="Description" required name="description" defaultValue={values.description} rows={3} maxLength={1500} /></div>
    </ActionForm>
  );
}

export function ActivityForm({ values }: { values: { id?: string; name: string; category: string; date: string; status: string; description: string } }) {
  return (
    <ActionForm action={saveActivityAction} submit="Save activity" toastOnSuccess={false} className={grid}>
      <Hidden id={values.id} />
      <Field label="Activity name" required name="name" defaultValue={values.name} maxLength={200} />
      <SelectField label="Category" required name="category" defaultValue={values.category}>{ACTIVITY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</SelectField>
      <Field label="Scheduled date" required name="date" type="date" defaultValue={values.date} />
      <SelectField label="Status" required name="status" defaultValue={values.status}>{ACTIVITY_STATUSES.map((s) => <option key={s}>{s}</option>)}</SelectField>
      <div className="sm:col-span-2"><TextareaField label="Description" required name="description" defaultValue={values.description} rows={3} maxLength={1500} /></div>
    </ActionForm>
  );
}
