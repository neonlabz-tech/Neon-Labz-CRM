import { LeadForm } from "@/components/leads/lead-form";
import { Modal } from "@/components/ui/modal";
import { requireAction } from "@/lib/auth";
import { leadId, peekSeq } from "@/lib/counters";
import { todayISO } from "@/lib/dates";

export default async function Intercepted() {
  await requireAction("leads.manage");
  return <Modal title="Add lead" subtitle={leadId(await peekSeq("lead"))}><LeadForm defaults={{ date: todayISO() }} /></Modal>;
}
