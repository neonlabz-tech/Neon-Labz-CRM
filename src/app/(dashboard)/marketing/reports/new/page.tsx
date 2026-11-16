import { ReportForm } from "@/components/marketing/report-form";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { MarketingInfo } from "@/models/marketing-info";

export const metadata = { title: "Create marketing report" };

export default async function NewReportPage() {
  await requireAction("marketing.manage");
  await connectDb();
  const clients = await MarketingInfo.find().select("clientCode clientName brandName").sort({ clientName: 1 }).limit(500).lean();
  return (
    <>
      <PageHeader title="Create report" />
      {clients.length === 0 ? <EmptyState title="Add client info first" text="Reports are made for clients that have a Client info document." /> : (
        <Card><ReportForm clients={clients.map((c) => ({ code: c.clientCode, name: c.brandName || c.clientName }))} values={{ clientCode: "", title: "", startDate: "", endDate: "", contentDirection: "", clientSummary: "", nextActions: [] }} platforms={{}} /></Card>
      )}
    </>
  );
}
