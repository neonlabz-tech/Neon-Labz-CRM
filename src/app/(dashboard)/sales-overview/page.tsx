import Link from "next/link";
import { CompanyTarget } from "@/components/dashboard/company-target";
import { TeamRanking } from "@/components/dashboard/team-ranking";
import { Hero, Kpis, Panel } from "@/components/dashboard/widgets";
import { PeriodFilter } from "@/components/finance/period-filter";
import { DataTable } from "@/components/ui/data-table";
import { requireAction } from "@/lib/auth";
import { dateIn, periodNote, sum } from "@/lib/dashboard";
import { connectDb } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { MONTHS, readPeriod } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { companyGoals, periodTarget } from "@/lib/sales-targets";
import type { SearchParams } from "@/lib/pagination";
import { formatDay } from "@/lib/utils";
import { Invoice } from "@/models/invoice";
import { salesLeads } from "@/lib/own";
import { Lead } from "@/models/lead";
import { Payment } from "@/models/payment";

export const metadata = { title: "Sales overview" };

export default async function SalesOverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("sales.targets");
  const sp = await searchParams;
  const today = todayISO();
  const { year, month, prefix } = readPeriod(sp, today);
  const dates = dateIn(prefix, "date");
  await connectDb();
  // The Super Admin's own leads (Own projects) are not part of the sales team's numbers.
  const team = salesLeads(user.username);
  const [leads, converted, collected, pending, due, company] = await Promise.all([
    Lead.countDocuments({ ...dates, ...team }),
    Lead.countDocuments({ status: "Converted", ...dates, ...team }),
    Payment.aggregate<{ n: number }>(sum("amount", { status: "confirmed", ...dates })),
    Invoice.countDocuments({ approval: "pending" }),
    Lead.find({ status: { $nin: ["Converted", "Lost"] as ("Converted" | "Lost")[] }, next: { $gt: "", $lte: today }, ...team }).select("leadId business phone owner next status").sort({ next: 1 }).limit(30).lean(),
    companyGoals(),
  ]);

  return (
    <>
      <PeriodFilter year={year} month={month} basePath="/sales-overview" />
      <Hero kicker="Sales" title="Sales performance" note={periodNote(year, month, MONTHS)} badge={pending ? `${pending} awaiting approval` : "All payments reviewed"} alert={pending > 0} />
      <Kpis items={[{ label: "Leads", value: leads }, { label: "Converted", value: converted }, { label: "Confirmed collections", value: formatMoney(collected[0]?.n ?? 0) }, { label: "Pending approvals", value: pending, hint: "Open Approvals" }, { label: "Follow-ups due", value: due.length, hint: "Today and overdue" }]} />
      <CompanyTarget collected={collected[0]?.n ?? 0} target={periodTarget(company.monthlyTarget, year, month)} note={periodNote(year, month, MONTHS)} />
      <TeamRanking year={year} month={month} prefix={prefix} />
      <Panel title="Due and overdue follow-ups" empty={due.length ? undefined : "No follow-up is due."}>
        {due.length > 0 && (
          <DataTable
            rows={due}
            rowKey={(r) => r.leadId}
            columns={[
              { header: "Lead", cell: (r) => <Link prefetch={false} href={`/leads?q=${encodeURIComponent(r.leadId)}`} className="text-brand-700 hover:underline">{r.business} <span className="font-normal text-muted">· {r.leadId}</span></Link> },
              { header: "Phone", cell: (r) => r.phone || "—" },
              { header: "Stage", cell: (r) => r.status },
              { header: "Sales", cell: (r) => r.owner },
              { header: "Follow-up", cell: (r) => <span className={r.next < today ? "font-semibold text-danger" : ""}>{formatDay(r.next)}{r.next < today ? " · overdue" : ""}</span> },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
