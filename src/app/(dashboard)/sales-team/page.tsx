import Link from "next/link";
import { PeriodFilter } from "@/components/finance/period-filter";
import { StaffTargetForm } from "@/components/sales/target-forms";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Panel } from "@/components/ui/panel";
import { requireAction } from "@/lib/auth";
import { dateIn } from "@/lib/dashboard";
import { todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { readPeriod } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/pagination";
import { companyGoals, goalsFor, periodTarget } from "@/lib/sales-targets";
import { Lead } from "@/models/lead";
import { Payment } from "@/models/payment";
import { SalesTarget } from "@/models/sales-target";
import { User } from "@/models/user";

export const metadata = { title: "Sales team" };

type Row = { _id: string; n: number };

export default async function SalesTeamPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("sales.targets");
  const sp = await searchParams;
  const { year, month, prefix } = readPeriod(sp, todayISO());
  const edit = param(sp, "edit").toUpperCase();
  await connectDb();
  const dates = dateIn(prefix, "date");
  const [staff, saved, collected, leads, company] = await Promise.all([
    User.find({ role: "sales", active: true }).select("username fullName").sort({ username: 1 }).limit(200).lean(),
    SalesTarget.find().select("username name target rate dailyLeads dailyCalls").lean(),
    Payment.aggregate<Row>([{ $match: { status: "confirmed", ...dates } }, { $group: { _id: "$owner", n: { $sum: "$amount" } } }]),
    Lead.aggregate<Row>([{ $match: dates }, { $group: { _id: "$owner", n: { $sum: 1 } } }]),
    companyGoals(),
  ]);
  const own = new Map(saved.map((s) => [s.username, s]));
  const money = new Map(collected.map((r) => [r._id, r.n]));
  const count = new Map(leads.map((r) => [r._id, r.n]));
  const editing = staff.find((u) => u.username === edit);
  const editingGoals = editing ? await goalsFor(editing.username) : null;

  return (
    <>
      <PageHeader title="Sales team" subtitle="Each person's monthly target, commission rate and daily goals." />
      {editing && editingGoals && (
        <Panel title={`Manage targets · ${editing.username}`} closeHref="/sales-team">
          <StaffTargetForm values={{
            username: editing.username,
            name: own.get(editing.username)?.name || editing.fullName || editing.username,
            target: String(own.get(editing.username)?.target ?? 0),
            rate: String(own.get(editing.username)?.rate ?? company.defaultRate),
            dailyLeads: String(own.get(editing.username)?.dailyLeads ?? company.dailyLeads),
            dailyCalls: String(own.get(editing.username)?.dailyCalls ?? company.dailyCalls),
          }} />
        </Panel>
      )}
      <PeriodFilter basePath="/sales-team" year={year} month={month} />
      {staff.length === 0 ? <EmptyState title="No sales team yet" text="Add a salesperson in People & logins to set targets." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {await Promise.all(staff.map(async (user) => {
            const goals = await goalsFor(user.username);
            const target = periodTarget(goals.target, year, month);
            const got = money.get(user.username) ?? 0;
            const percent = target ? Math.round((100 * got) / target) : 0;
            const name = own.get(user.username)?.name || user.fullName || user.username;
            return (
              <article key={user.username} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700" aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{name}</p>
                    <p className="text-xs text-muted">{user.username}</p>
                  </div>
                  <span className={`text-sm font-bold ${percent >= 100 ? "text-success" : "text-muted"}`}>{percent}%</span>
                </div>
                <p className="mt-4 text-xs text-muted">Confirmed collections</p>
                <p className="text-xl font-bold">{formatMoney(got)}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-50" aria-hidden="true"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, percent)}%` }} /></div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-muted">Period target</dt><dd className="font-semibold">{formatMoney(target)}</dd></div>
                  <div><dt className="text-muted">Commission</dt><dd className="font-semibold">{goals.rate}%</dd></div>
                  <div><dt className="text-muted">Leads</dt><dd className="font-semibold">{count.get(user.username) ?? 0}</dd></div>
                </dl>
                <Link prefetch={false} href={`?edit=${user.username}&year=${year || "all"}&month=${month || "all"}`} className="mt-4 inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50">Manage targets & rate</Link>
              </article>
            );
          }))}
        </div>
      )}
    </>
  );
}
