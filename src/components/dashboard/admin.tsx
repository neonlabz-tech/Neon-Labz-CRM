import { ApprovalActions } from "@/components/sales/approval-actions";
import { tableStyles } from "@/components/ui/data-table";
import { PdfLink } from "@/components/ui/pdf-link";
import { connectDb } from "@/lib/db";
import { dateIn, group, periodNote, sum } from "@/lib/dashboard";
import { todayISO } from "@/lib/dates";
import { MONTHS, readPeriod } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/pagination";
import { PROJECT_STATUS, PROJECT_TYPES } from "@/lib/projects";
import { Client } from "@/models/client";
import { Department, Employee } from "@/models/hrms";
import { Expense, Payroll, Revenue } from "@/models/finance";
import { Invoice } from "@/models/invoice";
import { LEAD_STAGES, Lead } from "@/models/lead";
import { MarketingInfo } from "@/models/marketing-info";
import { MarketingPlan } from "@/models/marketing-plan";
import { MarketingReport } from "@/models/marketing-report";
import { Package } from "@/models/package";
import { Payment } from "@/models/payment";
import { PasswordReset } from "@/models/password-reset";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { PeriodFilter } from "@/components/finance/period-filter";
import { CompanyTarget } from "./company-target";
import { TeamRanking } from "./team-ranking";
import { companyGoals, periodTarget } from "@/lib/sales-targets";
import { Bars, ChartGrid, Kpis, PALETTE, Panel, Ring, slices, Tabs, toCounts, type Slice } from "./widgets";

type Row = { _id: unknown; n: number };
const total = (rows: Row[]) => rows[0]?.n ?? 0;
const named = (counts: [string, number][]): Slice[] => counts.map(([label, value], index) => ({ id: label, label, value, color: PALETTE[index % PALETTE.length]! }));
const STATUS = Object.entries(PROJECT_STATUS) as [string, string][];

export async function AdminDashboard({ username, sp }: { username: string; sp: SearchParams }) {
  const { year, month, prefix } = readPeriod(sp, todayISO());
  const board = param(sp, "board") === "own" ? "own" : "company";
  const base = new URLSearchParams(Object.entries(sp).flatMap(([key, value]) => (typeof value === "string" && key !== "board" ? [[key, value]] : [])));
  await connectDb();
  const note = periodNote(year, month, MONTHS);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4 [&>*]:mb-4">
        <Tabs items={[{ id: "company", label: "Company" }, { id: "own", label: "Own projects" }]} current={board} base={base} />
        <PeriodFilter year={year} month={month} basePath="/dashboard" keep={{ board }} />
      </div>
      {board === "own" ? <Own username={username} prefix={prefix} /> : <Company prefix={prefix} note={note} year={year} month={month} />}
    </>
  );
}

async function Company({ prefix, note, year, month }: { prefix: string; note: string; year: string; month: string }) {
  const dates = dateIn(prefix, "date");
  const projectMatch = { archived: false, ...dateIn(prefix, "startDate", "dueDate") };
  const [waiting, salesRevenue, manualRevenue, status, ownCount, people, packages, perDepartment, departments, stages, payroll, expenses, revenues, confirmed, expenseKinds, salary, requests] = await Promise.all([
    Invoice.find({ approval: "pending" }).select("receiptNo clientName salesOwner amount type date").sort({ createdAt: -1 }).limit(10).lean(),
    Payment.aggregate<Row>(sum("amount", { status: "confirmed", ...dates })),
    Revenue.aggregate<Row>(sum("amount", dates)),
    Project.aggregate<Row>(group("status", projectMatch)),
    Project.countDocuments({ ...projectMatch, owner: { $regex: "^SA_" } }),
    Employee.countDocuments({ status: "Active" }),
    Package.countDocuments({ status: "active" }),
    Employee.aggregate<Row>(group("department", { status: "Active" })),
    Department.find().select("name").sort({ name: 1 }).lean(),
    Lead.aggregate<Row>(group("status", dates)),
    Payroll.countDocuments(dates),
    Expense.countDocuments(dates),
    Revenue.countDocuments(dates),
    Payment.countDocuments({ status: "confirmed", ...dates }),
    Expense.aggregate<Row>([{ $match: dates }, { $group: { _id: "$category", n: { $sum: "$amount" } } }]),
    Payroll.aggregate<Row>([{ $match: { status: "Paid", ...dates } }, { $group: { _id: null, n: { $sum: { $add: ["$base", "$commission"] } } } }]),
    PasswordReset.countDocuments({ purpose: "staff-request", status: "open", expiresAt: { $gt: new Date() } }),
  ]);
  const projectCounts = toCounts(status);
  const projectTotal = Object.values(projectCounts).reduce((a, b) => a + b, 0);
  const departmentCounts = toCounts(perDepartment);
  const expenseRows = [...expenseKinds.map((row) => [String(row._id), row.n] as [string, number]), ...(total(salary) ? [["Salary", total(salary)] as [string, number]] : [])];
  const revenueTotal = total(salesRevenue) + total(manualRevenue);
  const company = await companyGoals();

  return (
    <>
      <CompanyTarget collected={total(salesRevenue)} target={periodTarget(company.monthlyTarget, year, month)} note={note} />
      <Kpis items={[
        { label: "Revenue", value: formatMoney(revenueTotal), hint: note },
        { label: "Projects", value: projectTotal },
        { label: "Own projects", value: ownCount },
        { label: "People", value: people },
        { label: "Packages", value: packages },
        { label: "Password requests", value: requests, hint: "Waiting for you" },
      ]} />
      <TeamRanking year={year} month={month} prefix={prefix} />
      <Panel title="Payment approval" empty={waiting.length ? undefined : "No payment is waiting for approval."}>
        {waiting.length > 0 && (
          <ul className="divide-y divide-line">
            {waiting.map((invoice) => (
              <li key={String(invoice._id)} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <strong>{invoice.clientName}</strong>
                  <p className="text-muted">{invoice.type} · {invoice.salesOwner} · {invoice.receiptNo} · {invoice.date}</p>
                </div>
                <b>{formatMoney(invoice.amount)}</b>
                <div className="flex gap-2"><PdfLink kind="receipt" id={String(invoice._id)} label="View" /><ApprovalActions id={String(invoice._id)} client={invoice.clientName} /></div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <ChartGrid cols={3}>
        <Ring title="Project status" data={slices(STATUS, projectCounts)} />
        <Ring title="Sales leads" data={slices(LEAD_STAGES.map((s) => [s, s] as const), toCounts(stages))} />
        <Ring title="People by department" data={departments.map((d, index) => ({ id: String(d._id), label: d.name, value: departmentCounts[String(d._id)] ?? 0, color: PALETTE[index % PALETTE.length]! }))} />
      </ChartGrid>
      <ChartGrid>
        <Bars title="Finance records" data={named([["Payroll", payroll], ["Expenses", expenses], ["Manual revenue entries", revenues], ["Project payments", confirmed]])} />
        <Bars title="Expenses" data={named(expenseRows)} format="money" />
      </ChartGrid>
    </>
  );
}

async function Own({ username, prefix }: { username: string; prefix: string }) {
  const match = { owner: username, archived: false, ...dateIn(prefix, "startDate", "dueDate") };
  const [projects, byStatus, byType, docs, plans, reports] = await Promise.all([
    Project.find(match).select("code name clientName type status").sort({ createdAt: -1 }).limit(50).lean(),
    Project.aggregate<Row>(group("status", match)),
    Project.aggregate<Row>(group("type", match)),
    MarketingInfo.countDocuments({ createdBy: username }),
    MarketingPlan.countDocuments({ createdBy: username, ...dateIn(prefix, "startDate", "endDate") }),
    MarketingReport.countDocuments({ createdBy: username, ...dateIn(prefix, "startDate", "endDate") }),
  ]);
  const ids = projects.map((p) => p._id);
  const [tasks, clients] = await Promise.all([Task.countDocuments({ projectId: { $in: ids } }), Client.countDocuments({ code: { $in: projects.map((p) => p.clientCode) } })]);
  const counts = toCounts(byStatus);
  return (
    <>
      <Kpis items={[{ label: "Projects", value: projects.length }, { label: "In progress", value: counts["in-progress"] ?? 0 }, { label: "Clients", value: clients }, { label: "Tasks", value: tasks }, { label: "Marketing documents", value: docs + plans + reports }]} />
      <ChartGrid>
        <Ring title="Project status" data={slices(STATUS, counts)} />
        <Bars title="Project type" data={slices(PROJECT_TYPES.map((t) => [t, t[0]!.toUpperCase() + t.slice(1)] as const), toCounts(byType))} />
      </ChartGrid>
      <Panel title="Projects" empty={projects.length ? undefined : "No own projects yet."}>
        {projects.length > 0 && (
          <div className={tableStyles.shell}><table className={tableStyles.table}>
            <thead className={tableStyles.head}><tr>{["Code", "Project", "Client", "Type", "Status"].map((h) => <th key={h} className={tableStyles.th}>{h}</th>)}</tr></thead>
            <tbody className={tableStyles.body}>
              {projects.map((p) => <tr key={p.code} className={tableStyles.row}><td className={tableStyles.td}><code>{p.code}</code></td><td className={tableStyles.td}>{p.name}</td><td className={tableStyles.td}>{p.clientName}</td><td className={`${tableStyles.td} capitalize`}>{p.type}</td><td className={tableStyles.td}>{PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS] ?? p.status}</td></tr>)}
            </tbody>
          </table></div>
        )}
      </Panel>
    </>
  );
}
