"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { done, fail } from "@/lib/form";
import { cents } from "@/lib/money";
import { notifyRole, notifyUsers, notifyWork } from "@/lib/notify";
import { workTypeOf } from "@/lib/work-type";
import { Quotation } from "@/models/quotation";
import { deleteFromR2 } from "@/lib/r2";
import { reservedAmount } from "@/lib/payments";
import { Client } from "@/models/client";
import { Invoice } from "@/models/invoice";
import { Lead } from "@/models/lead";
import { Payment } from "@/models/payment";
import type { ActionState } from "@/types";

function refresh() {
  for (const path of ["/approvals", "/payments", "/clients", "/dashboard"]) revalidatePath(path);
}

export async function approveInvoiceAction(invoiceId: string): Promise<ActionState> {
  const admin = await requireAction("payments.approve");
  await connectDb();
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return fail("That invoice was not found.");
  if (invoice.approval === "approved") return done("Already approved.");
  const payment = await Payment.findById(invoice.paymentId);
  if (!payment || payment.status === "cancelled") return fail("This payment was cancelled.");

  const others = await reservedAmount(payment.quoteId, payment._id);
  if (cents(others) + cents(payment.amount) > cents(invoice.quoteTotal)) {
    return fail("Cannot confirm. Receipts would exceed the quotation total.");
  }

  const oldPdf = invoice.pdfUrl;
  invoice.pdfUrl = "";
  invoice.approval = "approved";
  invoice.approvedBy = admin.username;
  invoice.approvedAt = new Date();
  payment.status = "confirmed";
  payment.approval = "approved";
  await Promise.all([invoice.save(), payment.save()]);
  if (oldPdf) await deleteFromR2(oldPdf);

  const lead = await Lead.findOne({ leadId: payment.leadId }).lean();
  const quote = await Quotation.findById(payment.quoteId).select("items").lean();
  const services = [...new Set((quote?.items ?? []).map((i) => i.service).filter((v): v is string => !!v))];
  const workType = workTypeOf(...(services.length ? services : [lead?.service]));
  const existed = await Client.exists({ code: payment.clientCode });
  await Client.updateOne(
    { code: payment.clientCode },
    {
      $set: { name: payment.clientName, email: lead?.email ?? "", phone: lead?.phone ?? "", address: lead?.address ?? "", service: services.join(", ") || lead?.service || "", workType, leadId: payment.leadId, salesOwner: payment.owner },
      $setOnInsert: { approvedAt: new Date() },
    },
    { upsert: true }
  );

  if (invoice.salesOwner !== admin.username) await notifyUsers([invoice.salesOwner], `The Super Admin approved the payment for ${invoice.clientName}. Receipt ${invoice.receiptNo} is ready.`, "/payments");
  if (!existed) {
    const text = `${invoice.clientName} is now a client. Open Clients to start the project.`;
    await notifyRole("superadmin", text, "/clients");
    await notifyWork(workType, text, "/clients");
  }
  await writeAudit(admin.username, "payment.approved", { receiptNo: invoice.receiptNo });
  refresh();
  return done(`${invoice.receiptNo} approved. ${invoice.clientName} is now a client.`);
}

export async function cancelPaymentAction(invoiceId: string): Promise<ActionState> {
  const admin = await requireAction("payments.approve");
  await connectDb();
  const invoice = await Invoice.findById(invoiceId).select("approval paymentId receiptNo pdfUrl salesOwner clientName").lean();
  if (!invoice) return fail("That invoice was not found.");
  if (invoice.approval === "approved") return fail("An approved payment cannot be cancelled.");
  await Payment.updateOne({ _id: invoice.paymentId }, { status: "cancelled" });
  await Invoice.deleteOne({ _id: invoiceId });
  if (invoice.pdfUrl) await deleteFromR2(invoice.pdfUrl);
  await notifyUsers([invoice.salesOwner], `The Super Admin rejected the payment for ${invoice.clientName} (${invoice.receiptNo}). You can submit it again.`, "/payments");
  await writeAudit(admin.username, "payment.cancelled", { receiptNo: invoice.receiptNo });
  refresh();
  return done("Payment rejected.");
}
