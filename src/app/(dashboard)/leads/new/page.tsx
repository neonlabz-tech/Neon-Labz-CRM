import { LeadForm } from "@/components/leads/lead-form";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { leadId, peekSeq } from "@/lib/counters";
import { todayISO } from "@/lib/dates";

export const metadata = { title: "Add lead" };

export default async function NewLeadPage() {
  await requireAction("leads.manage");
  return (
    <>
      <PageHeader title="Add a lead" subtitle={`Next lead ID: ${leadId(await peekSeq("lead"))}`} />
      <Card><LeadForm defaults={{ date: todayISO() }} /></Card>
    </>
  );
}
