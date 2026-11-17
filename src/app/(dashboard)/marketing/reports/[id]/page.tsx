import { notFound } from "next/navigation";
import { ReportForm } from "@/components/marketing/report-form";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { REPORT_PLATFORMS, emptyPlatform, type PlatformData } from "@/lib/marketing";
import { isId } from "@/lib/project-access";
import { MarketingInfo } from "@/models/marketing-info";
import { MarketingReport } from "@/models/marketing-report";

export const metadata = { title: "Marketing report" };

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAction("marketing.manage");
  const { id } = await params;
  if (!isId(id)) notFound();
  await connectDb();
  const [report, clients] = await Promise.all([
    MarketingReport.findById(id).lean(),
    MarketingInfo.find().select("clientCode clientName brandName").sort({ clientName: 1 }).limit(500).lean(),
  ]);
  if (!report) notFound();
  const platforms = Object.fromEntries(REPORT_PLATFORMS.map(([key]) => [key, { ...emptyPlatform(), ...(JSON.parse(JSON.stringify(report.platforms?.[key] ?? {})) as Partial<PlatformData>) }]));
  return (
    <>
      <PageHeader title={report.title || `${report.clientName} report`} subtitle={`${report.startDate} to ${report.endDate}`} />
      <Card>
        <ReportForm
          id={id}
          clients={clients.map((c) => ({ code: c.clientCode, name: c.brandName || c.clientName }))}
          values={{ clientCode: report.clientCode, title: report.title, startDate: report.startDate, endDate: report.endDate, contentDirection: report.contentDirection, clientSummary: report.clientSummary, nextActions: report.nextActions }}
          platforms={platforms}
        />
      </Card>
    </>
  );
}
