import { LeadForm } from "@/components/leads/lead-form";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { leadId, peekSeq } from "@/lib/counters";
import { todayISO } from "@/lib/dates";
import { ownView } from "@/lib/own";
import type { SearchParams } from "@/lib/pagination";

export const metadata = { title: "Add lead" };

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("leads.manage");
  const own = ownView(user.role, await searchParams);
  return (
    <>
      <PageHeader title="Add a lead" subtitle={`Next lead ID: ${leadId(await peekSeq("lead"))}`} />
      <Card><LeadForm own={own} defaults={{ date: todayISO() }} /></Card>
    </>
  );
}
