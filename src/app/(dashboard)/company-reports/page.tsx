import { Briefcase, ChartColumn, ClipboardList, FolderKanban, HandCoins, ListChecks, Package, PhoneCall, UserRound, UsersRound, Wallet } from "lucide-react";
import Link from "next/link";
import { ReportActions } from "@/components/reports/report-actions";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { REPORT_TYPES, readReportPeriod, type ReportId } from "@/lib/company-reports";
import { todayISO } from "@/lib/dates";
import type { SearchParams } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reports" };

const ICONS: Record<ReportId, typeof Wallet> = {
  sales: PhoneCall, collections: Wallet, clients: Briefcase, projects: FolderKanban, delivery: ListChecks, marketing: ClipboardList,
  profit: ChartColumn, expenses: HandCoins, payroll: UserRound, hr: UsersRound, quotes: Package,
};
const TAGS: Record<string, string> = {
  Sales: "bg-brand-50 text-brand-700", Revenue: "bg-success-soft text-success", CRM: "bg-danger-soft text-danger", Delivery: "bg-info-soft text-info",
  Marketing: "bg-warning-soft text-warning", Finance: "bg-info-soft text-info", HR: "bg-brand-50 text-brand-700",
};
const input = "h-11 rounded-xl border border-line bg-white px-3 text-sm";

export default async function CompanyReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("reports.company");
  const sp = await searchParams;
  const today = todayISO();
  const period = readReportPeriod(sp, today);
  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: 8 }, (_, i) => String(thisYear + 1 - i));
  if (!years.includes(period.year)) years.push(period.year);
  const modes = [["month", "Monthly"], ["year", "Yearly"], ["custom", "Custom dates"]] as const;

  return (
    <>
      <PageHeader title="Reports" subtitle="Pick the dates, then preview a report or save it as a PDF." />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex gap-2" role="tablist">
          {modes.map(([value, label]) => (
            <Link key={value} prefetch={false} role="tab" aria-selected={period.mode === value} href={`/company-reports?period=${value}`}
              className={cn("rounded-xl px-4 py-2 text-sm font-semibold", period.mode === value ? "bg-brand-600 text-white" : "bg-white text-ink ring-1 ring-line hover:bg-brand-50")}>{label}</Link>
          ))}
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="period" value={period.mode} />
          {period.mode === "month" && <input type="month" name="month" defaultValue={period.month} aria-label="Month" className={input} required />}
          {period.mode === "year" && (
            <select name="year" defaultValue={period.year} aria-label="Year" className={input}>{years.map((y) => <option key={y}>{y}</option>)}</select>
          )}
          {period.mode === "custom" && (
            <>
              <input type="date" name="from" defaultValue={period.from} aria-label="From date" className={input} required />
              <input type="date" name="to" defaultValue={period.to} aria-label="To date" className={input} required />
            </>
          )}
          <button type="submit" className="brand-gradient h-11 rounded-xl px-5 text-sm font-semibold text-white">Apply</button>
        </form>
        <p className="ml-auto text-sm text-muted">Showing <strong className="text-ink">{period.label}</strong></p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {REPORT_TYPES.map((report) => {
          const Icon = ICONS[report.id];
          return (
            <Card key={report.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
                <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", TAGS[report.tag])}>{report.tag}</span>
              </div>
              <h2 className="mt-3 font-semibold">{report.title}</h2>
              <p className="mt-1 text-sm text-muted">{report.description}</p>
              <ReportActions id={`${report.id}~${period.from}~${period.to}`} title={report.title} />
            </Card>
          );
        })}
      </div>
    </>
  );
}
