import { PlanForm } from "@/components/marketing/plan-form";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { backfillWorkTypes } from "@/lib/client-work";
import { clientWorkFilter } from "@/lib/work-type";
import { Client } from "@/models/client";

export const metadata = { title: "New content plan" };

export default async function NewPlanPage() {
  await requireAction("marketing.manage");
  await backfillWorkTypes();
  await connectDb();
  const clients = await (await Client.find(clientWorkFilter("marketing")).select("code name").sort({ name: 1 }).limit(500).lean()).map((c) => ({ code: c.code, name: c.name }));
  return (
    <>
      <PageHeader title="New content plan" />
      {clients.length === 0 ? <EmptyState title="No clients yet" text="Plans can be made once a client has paid." /> : (
        <Card><PlanForm clients={clients} values={{ clientCode: "", title: "", startDate: "", endDate: "", address: "", cadence: "", confirmNotes: "" }} months={[]} /></Card>
      )}
    </>
  );
}
