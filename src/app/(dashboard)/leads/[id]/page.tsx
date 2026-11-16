import { notFound } from "next/navigation";
import { LeadForm } from "@/components/leads/lead-form";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { ownerScope } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { Lead } from "@/models/lead";

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
          <h2 className="mb-3 font-semibold">Call history</h2>
          {lead.calls.length === 0 ? (
            <p className="text-sm text-muted">No calls logged yet.</p>
          ) : (
            <ol className="space-y-3">
              {[...lead.calls].reverse().map((call, index) => (
                <li key={index} className="rounded-xl bg-brand-50/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={call.outcome === "Answered" ? "success" : "warning"}>{call.outcome}</Badge><span className="text-muted">{formatDateTime(call.createdAt)}</span></div>
                  <p className="mt-1">Stage: {call.status}{call.next ? ` · Next: ${call.next}` : ""}</p>
                  {call.note && <p className="mt-1 text-muted">{call.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
