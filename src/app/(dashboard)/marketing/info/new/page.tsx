import { InfoForm } from "@/components/marketing/info-form";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { backfillWorkTypes } from "@/lib/client-work";
import { clientWorkFilter } from "@/lib/work-type";
import { Client } from "@/models/client";
import { MarketingInfo } from "@/models/marketing-info";

export const metadata = { title: "Add client info" };

export default async function NewInfoPage() {
  await requireAction("marketing.manage");
  await backfillWorkTypes();
  await connectDb();
  const used = await MarketingInfo.distinct("clientCode");
  const clients = await (await Client.find({ ...clientWorkFilter("marketing"), code: { $nin: used } }).select("code name").sort({ name: 1 }).limit(500).lean()).map((c) => ({ code: c.code, name: c.name }));
  return (
    <>
      <PageHeader title="Add client info" />
      {clients.length === 0 ? <EmptyState title="Every client already has info" text="Open an existing one to edit it." /> : (
        <Card><InfoForm clients={clients} clientCode="" lockClient={false} values={{}} social={{}} /></Card>
      )}
    </>
  );
}
