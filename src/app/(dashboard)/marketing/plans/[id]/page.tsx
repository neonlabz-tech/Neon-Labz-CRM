import { notFound } from "next/navigation";
import { PlanForm, type PlanMonth } from "@/components/marketing/plan-form";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { isId } from "@/lib/project-access";
import { clientWorkFilter } from "@/lib/work-type";
import { Client } from "@/models/client";
import { MarketingPlan } from "@/models/marketing-plan";

export const metadata = { title: "Content plan" };

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAction("marketing.manage");
  const { id } = await params;
  if (!isId(id)) notFound();
  await connectDb();
  const [plan, clients] = await Promise.all([MarketingPlan.findById(id).lean(), Client.find(clientWorkFilter("marketing")).select("code name").sort({ name: 1 }).limit(500).lean()]);
  if (!plan) notFound();
  const months = JSON.parse(JSON.stringify(plan.months)) as PlanMonth[];
  return (
    <>
      <PageHeader title={plan.title} subtitle={plan.clientName} />
      <Card>
        <PlanForm
          id={id}
          clients={clients.map((c) => ({ code: c.code, name: c.name }))}
          values={{ clientCode: plan.clientCode, title: plan.title, startDate: plan.startDate, endDate: plan.endDate, address: plan.address, cadence: plan.cadence, confirmNotes: plan.confirmNotes }}
          months={months}
        />
      </Card>
    </>
  );
}
