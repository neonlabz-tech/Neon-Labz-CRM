"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { nextSeq, saleCode } from "@/lib/counters";
import { fail, invalid } from "@/lib/form";
import { cents, formatMoney, round2 } from "@/lib/money";
import { notifyRole } from "@/lib/notify";
import { approveInvoiceAction } from "./approval-actions";
import { reservedAmount } from "@/lib/payments";
import { uploadFile } from "@/lib/uploads";
import { paymentSchema } from "@/schemas/payment";
import { Invoice } from "@/models/invoice";
import { Lead } from "@/models/lead";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";
import type { ActionState } from "@/types";

export async function submitPaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("payments.record");
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const slip = formData.get("proof");
  if (!input.transactionId && !(slip instanceof File && slip.size > 0)) {
    const message = "Enter the transaction or reference no., or attach a receipt or slip.";
    return { ok: false, message, errors: { transactionId: message } };
  }

  await connectDb();
  const lead = await Lead.findOne({ leadId: input.leadId, owner: user.username, status: "Converted" }).lean();
  const quote = lead ? await Quotation.findOne({ leadId: lead.leadId }).lean() : null;
  if (!lead || !quote) return fail("Choose a converted client with a saved quotation.");

  const amount = round2(input.amount);
  if (cents(await reservedAmount(quote._id)) + cents(amount) > cents(quote.total)) {
    const message = "Payment exceeds the remaining quotation balance, including pending receipts.";
    return { ok: false, message, errors: { amount: message } };
  }

  const proof = await uploadFile(formData.get("proof"), "payment-proofs", { images: true, pdf: true, maxMb: 5, what: "receipt" });
  if (proof.error) return fail(proof.error);
  const proofUrl = proof.url;

  const payment = await Payment.create({
    saleCode: saleCode(await nextSeq("sale")), owner: user.username, quoteId: quote._id, leadId: lead.leadId,
    clientCode: lead.clientCode, clientName: lead.business, amount, date: input.date, type: input.type,
    method: input.method, transactionId: input.transactionId, proofUrl, status: "pending", approval: "pending",
  });

  const stem = lead.business.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "CLT";
  let receiptNo = "";
  let invoice: { _id: unknown } | null = null;
  for (let attempt = 0; attempt < 5 && !receiptNo; attempt += 1) {
    const sequence = (await Invoice.countDocuments({ quoteId: quote._id })) + 1 + attempt;
    const candidate = `RCP-${stem}-${String(sequence).padStart(3, "0")}`;
    try {
      invoice = await Invoice.create({
        receiptNo: candidate, paymentId: payment._id, quoteId: quote._id, quoteNumber: quote.number, quoteTotal: quote.total,
        salesOwner: user.username, clientName: lead.business, clientCode: lead.clientCode,
        contact: [lead.email, lead.phone].filter(Boolean).join(" · "),
        projectDetail: quote.items.map((i) => i.packageName).join(", "),
        amount, type: input.type, method: input.method, transactionId: input.transactionId, date: input.date,
      });
      receiptNo = candidate;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  if (!receiptNo) {
    await Payment.deleteOne({ _id: payment._id });
    return fail("Could not create the receipt number. Please try again.");
  }

  const own = user.role === "superadmin";
  if (own) {
    const approved = await approveInvoiceAction(String(invoice?._id));
    if (!approved.ok) return approved;
  } else {
    await notifyRole("superadmin", `${user.username} submitted a payment of ${formatMoney(amount)} for ${lead.business}. Review it under Approvals.`, "/approvals");
  }
  await writeAudit(user.username, "payment.submitted", { receiptNo, amount });
  revalidatePath("/payments");
  revalidatePath("/approvals");
  redirect(own ? "/payments?own=1" : "/payments");
}
