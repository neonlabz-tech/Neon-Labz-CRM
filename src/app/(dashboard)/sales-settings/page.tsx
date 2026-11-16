import { SalesSettingsForm } from "@/components/sales/target-forms";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { companyGoals } from "@/lib/sales-targets";

export const metadata = { title: "Sales settings" };

export default async function SalesSettingsPage() {
  await requireAction("sales.targets");
  await connectDb();
  const goals = await companyGoals();
  return (
    <>
      <PageHeader title="Sales settings" subtitle="Company targets and daily activity goals. A salesperson with no commission rate or daily goals of their own uses these. Sales targets are set for each person under Team." />
      <Card className="max-w-2xl">
        <SalesSettingsForm values={{ monthlyTarget: String(goals.monthlyTarget), dailyLeads: String(goals.dailyLeads), dailyCalls: String(goals.dailyCalls), defaultRate: String(goals.defaultRate) }} />
      </Card>
    </>
  );
}
