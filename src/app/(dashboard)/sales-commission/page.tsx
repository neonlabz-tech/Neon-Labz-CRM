import Link from "next/link";
import { Kpis } from "@/components/dashboard/widgets";
import { PeriodFilter } from "@/components/finance/period-filter";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { requireAction } from "@/lib/auth";
import { periodNote } from "@/lib/dashboard";
import { todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { MONTHS, readPeriod } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { commissionEarned, commissionIn } from "@/lib/my-sales";
import type { SearchParams } from "@/lib/pagination";
import { Payroll } from "@/models/finance";
import { Employee } from "@/models/hrms";
import { User } from "@/models/user";

export const metadata = { title: "Sales commission" };

type Status = "Paid" | "Part paid" | "In payroll" | "Pending" | "Nothing due" | "Not in HR";

/**
 * Who is owed how much commission. Nothing is marked by hand: when a payment is saved as Paid in Finance > Payroll,
 * the commission on it counts here as paid for that person and month.
 */
export default async function SalesCommissionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("sales.targets");
  const sp = await searchParams;
  const { year, month, prefix } = readPeriod(sp, todayISO());
  await connectDb();
  const staff = await User.find({ role: "sales", active: true }).select("username fullName").sort({ username: 1 }).limit(200).lean();
  const logins = staff.map((u) => u.username);
  const [earned, employees] = await Promise.all([commissionEarned(logins, prefix), Employee.find({ username: { $in: logins } }).select("username").lean()]);
  const byLogin = new Map(employees.map((e) => [e.username, e._id]));
  const payroll = employees.length
    ? await Payroll.find({ employee: { $in: employees.map((e) => e._id) }, ...commissionIn(prefix) }).select("employee commission status").lean()
    : [];

  const rows = staff.map((user) => {
    const got = earned.get(user.username) ?? { sales: 0, rate: 0, earned: 0 };
    const id = byLogin.get(user.username);
    const mine = id ? payroll.filter((p) => String(p.employee) === String(id)) : [];
    const paid = Math.round(mine.filter((p) => p.status === "Paid").reduce((sum, p) => sum + p.commission, 0) * 100) / 100;
    const balance = Math.max(0, Math.round((got.earned - paid) * 100) / 100);
    const status: Status = !id ? (got.earned > 0 ? "Not in HR" : "Nothing due")
      : got.earned === 0 && paid === 0 ? "Nothing due"
      : balance === 0 ? "Paid"
      : paid > 0 ? "Part paid"
      : mine.length ? "In payroll" : "Pending";
    return { username: user.username, name: user.fullName || user.username, ...got, paid, balance, status };
  });
  const totals = rows.reduce((a, r) => ({ earned: a.earned + r.earned, paid: a.paid + r.paid, balance: a.balance + r.balance }), { earned: 0, paid: 0, balance: 0 });
  const tone = (s: Status) => (s === "Paid" ? "success" : s === "Nothing due" ? "info" : s === "Not in HR" ? "danger" : "warning");

  return (
    <>
      <PageHeader title="Commission" subtitle="What each salesperson has earned, what payroll has paid, and what is still to pay." />
      <PeriodFilter basePath="/sales-commission" year={year} month={month} />
      <Kpis items={[
        { label: "Commission earned", value: formatMoney(totals.earned), hint: periodNote(year, month, MONTHS) },
        { label: "Paid through payroll", value: formatMoney(totals.paid), hint: "Payments marked Paid" },
        { label: "Total payable", value: formatMoney(totals.balance), hint: "Still to pay" },
      ]} />
      {rows.length === 0 ? <EmptyState title="No sales team yet" text="Add a salesperson in People & logins." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.username}
          columns={[
            { header: "Salesperson", cell: (r) => <span>{r.name} <span className="font-normal text-muted">· {r.username}</span></span> },
            { header: "Approved sales", cell: (r) => formatMoney(r.sales) },
            { header: "Rate", cell: (r) => `${r.rate}%` },
            { header: "Commission earned", cell: (r) => <span className="font-semibold">{formatMoney(r.earned)}</span> },
            { header: "Paid", cell: (r) => formatMoney(r.paid) },
            { header: "To pay", cell: (r) => <span className={r.balance > 0 ? "font-semibold text-danger" : ""}>{formatMoney(r.balance)}</span> },
            { header: "Status", cell: (r) => <Badge tone={tone(r.status)}>{r.status}</Badge> },
            { header: "Payroll", cell: (r) => (r.status === "Not in HR" ? <span className="text-xs text-muted">Add in HR first</span> : <Link prefetch={false} href={`/finance/payroll?q=${r.username}${year ? `&year=${year}` : ""}${month ? `&month=${month}` : ""}`} className="text-sm font-semibold text-brand-700 hover:underline">Open payroll</Link>) },
          ]}
        />
      )}
      <p className="mt-3 text-xs text-muted">In Finance &gt; Payroll, choose the salesperson and the commission is filled in for you. When that payment is saved as Paid, it shows as Paid here. The person must also be added in HR with the same login.</p>
    </>
  );
}
