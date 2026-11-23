import { LeadForm } from "@/components/leads/lead-form";
import { Modal } from "@/components/ui/modal";
import { requireAction } from "@/lib/auth";
import { leadId, peekSeq } from "@/lib/counters";
import { todayISO } from "@/lib/dates";
import { ownView } from "@/lib/own";
import type { SearchParams } from "@/lib/pagination";

export default async function Intercepted({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("leads.manage");
  const own = ownView(user.role, await searchParams);
  return <Modal title="Add lead" subtitle={leadId(await peekSeq("lead"))}><LeadForm own={own} defaults={{ date: todayISO() }} /></Modal>;
}
