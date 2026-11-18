import { notFound } from "next/navigation";
import { LeadForm } from "@/components/leads/lead-form";
import { CallHistory } from "@/components/leads/call-history";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { ownerScope } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { todayISO } from "@/lib/dates";
import { CALL_OUTCOMES, LEAD_STAGES, Lead } from "@/models/lead";

export const metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAction("leads.manage");
  const { id } = await params;
  await connectDb();
  const lead = await Lead.findOne({ leadId: id, ...ownerScope(user) }).lean();
  if (!lead) notFound();
  return (
    <>
      <PageHeader title={lead.business} subtitle={`${lead.leadId}${lead.clientCode ? ` · Client ${lead.clientCode}` : ""}`} />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <LeadForm defaults={{ id: lead.leadId, date: lead.date, business: lead.business, phone: lead.phone, email: lead.email, address: lead.address, businessType: lead.businessType, source: lead.source, service: lead.service, status: lead.status, notes: lead.notes }} />
        </Card>
        <Card>
          <CallHistory
            leadId={lead.leadId}
            stage={lead.status}
            today={todayISO()}
            outcomes={CALL_OUTCOMES}
            stages={LEAD_STAGES}
            calls={lead.calls.map((call, index) => ({ index, outcome: call.outcome, status: call.status, next: call.next ?? "", note: call.note ?? "", when: formatDateTime(call.createdAt) }))}
          />
        </Card>
      </div>
    </>
  );
}
