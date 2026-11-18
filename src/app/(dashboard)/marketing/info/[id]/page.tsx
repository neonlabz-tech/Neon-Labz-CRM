import { notFound } from "next/navigation";
import { InfoForm } from "@/components/marketing/info-form";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { INFO_FIELDS, SOCIALS } from "@/lib/marketing";
import { Client } from "@/models/client";
import { MarketingInfo } from "@/models/marketing-info";

export const metadata = { title: "Client info" };

export default async function EditInfoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAction("marketing.manage");
  const { id } = await params;
  await connectDb();
  const [doc, client] = await Promise.all([MarketingInfo.findOne({ clientCode: id }).lean(), Client.findOne({ code: id }).select("logo").lean()]);
  if (!doc) notFound();
  const values = Object.fromEntries(INFO_FIELDS.map(([key]) => [key, (doc as Record<string, unknown>)[key] as string]));
  const stored = (doc.social ?? {}) as unknown as Record<string, { username?: string; pageLink?: string; password?: string }>;
  const social = Object.fromEntries(SOCIALS.map((key) => [key, { username: stored[key]?.username ?? "", pageLink: stored[key]?.pageLink ?? "", hasPassword: Boolean(stored[key]?.password) }]));
  return (
    <>
      <PageHeader title={doc.clientName} subtitle={doc.clientCode} />
      <Card><InfoForm clients={[{ code: doc.clientCode, name: doc.clientName }]} clientCode={doc.clientCode} lockClient values={values} social={social} logo={client?.logo ?? ""} /></Card>
    </>
  );
}
