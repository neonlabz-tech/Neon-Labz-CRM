import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { tableStyles } from "@/components/ui/data-table";
import { AccountActions } from "@/components/users/account-actions";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { Department, Employee } from "@/models/hrms";
import { PasswordReset } from "@/models/password-reset";
import { User } from "@/models/user";

export const metadata = { title: "People & logins" };

type Account = { username: string; role: string; fullName?: string; active: boolean };

function Group({ title, empty, children }: { title: string; empty?: string; children?: React.ReactNode }) {
  return (
    <Card className="mb-5 overflow-hidden p-0">
      <h2 className="border-b border-line bg-brand-50/60 px-5 py-3 font-semibold">{title}</h2>
      {children ?? <p className="px-5 py-4 text-sm text-muted">{empty}</p>}
    </Card>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className={`${tableStyles.table} min-w-[40rem]`}>
        <thead className={tableStyles.head}>
          <tr><th className="px-5 py-3">Employee</th><th className="px-3 py-3">Access</th><th className="px-3 py-3">Username</th><th className="px-3 py-3">Password</th><th className="px-3 py-3">Status</th><th className="px-5 py-3">Actions</th></tr>
        </thead>
        <tbody className={tableStyles.body}>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ name, access, account, me }: { name: string; access: string; account: Account; me: string }) {
  return (
    <tr className={tableStyles.row}>
      <td className="px-5 py-3 font-medium">{name}</td>
      <td className="px-3 py-3">{access}</td>
      <td className="px-3 py-3"><code className="rounded bg-brand-50 px-2 py-1 font-semibold text-brand-700">{account.username}</code></td>
      <td className="px-3 py-3 tracking-widest text-muted" aria-label="Password hidden">••••••</td>
      <td className="px-3 py-3"><Badge tone={account.active ? "success" : "danger"}>{account.active ? "Active" : "Inactive"}</Badge></td>
      <td className="px-5 py-3"><AccountActions username={account.username} active={account.active} self={account.username === me} /></td>
    </tr>
  );
}

export default async function UsersPage() {
  const admin = await requireAction("users.manage");
  await connectDb();
  const [accounts, departments, employees, requests] = await Promise.all([
    User.find().select("username role fullName active").sort({ username: 1 }).limit(500).lean(),
    Department.find().select("name").sort({ name: 1 }).lean(),
    Employee.find().select("name username department memberType").sort({ name: 1 }).limit(500).lean(),
    PasswordReset.find({ purpose: "staff-request", status: "open", expiresAt: { $gt: new Date() } }).select("username createdAt").sort({ createdAt: -1 }).lean(),
  ]);
  const byName = new Map(accounts.map((a) => [a.username, a]));
  const listed = new Set(employees.map((e) => e.username));
  const loose = accounts.filter((a) => a.role !== "superadmin" && !listed.has(a.username));

  return (
    <>
      <PageHeader title="People & logins" subtitle="View or change passwords and switch accounts on or off. Add new people in HR." />

      {requests.length > 0 && (
        <Card className="mb-6 border-warning/30 bg-warning-soft">
          <p className="font-semibold text-warning">Password help needed</p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {requests.map((item) => (
              <li key={String(item._id)}>{item.username} asked for a new password on {formatDateTime(item.createdAt)}. Use the pencil on their row.</li>
            ))}
          </ul>
        </Card>
      )}

      <Group title="Super Admin">
        <Table>
          {accounts.filter((a) => a.role === "superadmin").map((a) => <Row key={a.username} name={a.fullName || a.username} access="Super Admin" account={a} me={admin.username} />)}
        </Table>
      </Group>

      {departments.length === 0 && <p className="mb-5 text-sm text-muted">No departments yet. Add a department in HR, then add an admin or a team member and set a password.</p>}
      {departments.map((department) => {
        const people = employees
          .filter((e) => String(e.department) === String(department._id))
          .sort((a, b) => (a.memberType === b.memberType ? a.name.localeCompare(b.name) : a.memberType === "admin" ? -1 : 1));
        return (
          <Group key={String(department._id)} title={department.name} empty="No employees in this department. Add an admin or a team member in HR to issue a username and password.">
            {people.length > 0 && (
              <Table>
                {people.map((e) => {
                  const account = byName.get(e.username);
                  return account ? <Row key={e.username} name={e.name} access={e.memberType === "admin" ? "Admin" : "Team member"} account={account} me={admin.username} /> : null;
                })}
              </Table>
            )}
          </Group>
        );
      })}

      {loose.length > 0 && (
        <Group title="Other logins">
          <Table>{loose.map((a) => <Row key={a.username} name={a.fullName || a.username} access={ROLE_LABEL[a.role as keyof typeof ROLE_LABEL] ?? a.role} account={a} me={admin.username} />)}</Table>
        </Group>
      )}
    </>
  );
}
