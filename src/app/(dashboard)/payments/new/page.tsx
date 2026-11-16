import { PaymentForm } from "@/components/sales/payment-form";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Lead } from "@/models/lead";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage() {
  const user = await requireAction("payments.record");
  await connectDb();
  const quotes = await Quotation.find({ owner: user.username }).select("leadId number total client clientCode").sort({ createdAt: -1 }).limit(200).lean();
  const paid = await Payment.aggregate<{ _id: unknown; sum: number }>([
    { $match: { quoteId: { $in: quotes.map((q) => q._id) }, status: { $ne: "cancelled" } } },
    { $group: { _id: "$quoteId", sum: { $sum: "$amount" } } },
  ]);
  const used = new Map(paid.map((p) => [String(p._id), p.sum]));
  const converted = new Set((await Lead.find({ owner: user.username, status: "Converted", leadId: { $in: quotes.map((q) => q.leadId) } }).select("leadId").lean()).map((l) => l.leadId));

  const clients = quotes
    .filter((q) => converted.has(q.leadId) && q.total - (used.get(String(q._id)) ?? 0) > 0.004)
    .map((q) => ({ leadId: q.leadId, label: `${q.client} (${q.clientCode}) · ${q.number} · ${formatMoney(q.total - (used.get(String(q._id)) ?? 0))} left` }));

  return (
    <>
      <PageHeader title="Record a payment" subtitle="You will get a receipt number like RCP-CLIENT-001 once it is saved." />
      {clients.length === 0 ? (
        <EmptyState title="No client can be paid yet" text="A client needs to be Converted and have a saved quotation with a balance left." />
      ) : (
        <Card><PaymentForm clients={clients} today={todayISO()} own={user.role === "superadmin"} /></Card>
      )}
    </>
  );
}
