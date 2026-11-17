import { richToHtml } from "@/lib/rich-text";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/card";
import { QuoteForm } from "@/components/sales/quote-form";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { addDays, todayISO } from "@/lib/dates";
import { ownerScope } from "@/lib/permissions";
import { Lead } from "@/models/lead";
import { Package } from "@/models/package";
import { Quotation } from "@/models/quotation";

export const metadata = { title: "Quotation" };

export default async function QuotationPage({ params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireAction("quotations.manage");
  const { leadId } = await params;
  await connectDb();
  const lead = await Lead.findOne({ leadId, ...ownerScope(user) }).select("business clientCode status").lean();
  if (!lead) notFound();
  const [packages, quote] = await Promise.all([
    Package.find({ status: "active" }).select("name price description features icon").sort({ name: 1 }).lean(),
    Quotation.findOne({ leadId }).lean(),
  ]);
  if (lead.status === "Lost" && !quote) notFound();
  const today = todayISO();

  return (
    <>
      <PageHeader title={quote ? `Quotation ${quote.number}` : "New quotation"} subtitle={`${lead.business} · ${lead.clientCode || leadId}`} />
      <Card>
        <QuoteForm
          leadId={leadId}
          packages={packages.map((p) => ({ id: String(p._id), name: p.name, price: p.price, scope: richToHtml([p.description, ...p.features.map((f) => `• ${f}`)].filter(Boolean).join("\n")), icon: p.icon ?? "" }))}
          defaults={{
            date: quote?.date ?? today,
            valid: quote?.valid ?? addDays(today, 14),
            discount: quote?.discountPercent ?? 0,
            terms: quote?.terms ?? "",
            lines: quote?.items.map((i) => ({ packageId: i.packageId ?? "custom", customName: i.packageId === "custom" ? i.packageName : "", price: String(i.price), scope: richToHtml(i.scope), icon: i.icon ?? "" })) ?? [],
          }}
        />
      </Card>
    </>
  );
}
