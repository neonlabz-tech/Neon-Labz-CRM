"use server";

import { cleanRich, richHasText } from "@/lib/rich-text";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { nextSeq, quoteNumber } from "@/lib/counters";
import { addDays, dateIsAllowed } from "@/lib/dates";
import { done, fail, invalid } from "@/lib/form";
import { quoteFigures, round2 } from "@/lib/money";
import { ownerScope } from "@/lib/permissions";
import { deleteFromR2 } from "@/lib/r2";
import { reservedAmount } from "@/lib/payments";
import { resolveIcon } from "@/lib/package-icons";
import { quotationSchema } from "@/schemas/quotation";
import { Lead } from "@/models/lead";
import { Invoice } from "@/models/invoice";
import { Package } from "@/models/package";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";
import type { ActionState } from "@/types";

export async function saveQuotationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("quotations.manage");
  const parsed = quotationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  await connectDb();
  const lead = await Lead.findOne({ leadId: input.leadId, ...ownerScope(user) }).lean();
  if (!lead) return fail("Choose a lead.");
  const existing = await Quotation.findOne({ leadId: lead.leadId });
  if (lead.status === "Lost" && !existing) return fail("This lead is marked Lost, so it cannot get a new quotation.");

  if (!dateIsAllowed(input.date, existing?.date ?? "")) return fail("Quotation date cannot be before today.");
  const valid = input.valid || addDays(input.date, 14);
  if (valid < input.date) return fail("Validity date cannot be before the quotation date.");
  if (!dateIsAllowed(valid, existing?.valid ?? "")) return fail("Validity date cannot be before today.");

  const ids = input.lines.map((l) => l.packageId).filter((id) => id !== "custom");
  const packages = await Package.find({ _id: { $in: ids } }).select("name category duration icon").lean();
  const items = [];
  for (const line of input.lines) {
    const custom = line.packageId === "custom";
    const pkg = packages.find((p) => String(p._id) === line.packageId);
    if (!custom && !pkg) return fail("Choose a package on every line.");
    const packageName = custom ? line.customName : pkg!.name;
    if (!packageName) return fail("Each custom package needs a title.");
    if (!richHasText(line.scope)) return fail("Each package needs a scope.");
    items.push({
      packageId: custom ? "custom" : line.packageId,
      packageName,
      service: custom ? "" : pkg!.category,
      period: custom ? "Custom quotation" : pkg!.duration,
      icon: resolveIcon(line.icon || (custom ? "" : pkg!.icon), packageName, custom ? "" : pkg!.category),
      price: round2(line.price),
      scope: cleanRich(line.scope),
    });
  }
  const figures = quoteFigures(items.reduce((sum, item) => sum + item.price, 0), input.discount);
  const data = {
    owner: lead.owner, leadId: lead.leadId, clientCode: lead.clientCode, client: lead.business, email: lead.email, phone: lead.phone,
    items, subtotal: figures.subtotal, discountPercent: figures.discountPercent, discount: figures.discount, total: figures.total,
    terms: richHasText(input.terms) ? cleanRich(input.terms) : "As agreed with the client.", date: input.date, valid,
  };

  if (existing) {
    const paid = await reservedAmount(existing._id);
    if (Math.round(paid * 100) > Math.round(figures.total * 100)) return fail("The new total is lower than the payments already recorded.");
    const oldPdf = existing.pdfUrl;
    Object.assign(existing, data, { pdfUrl: "" });
    await existing.save();
    if (oldPdf) await deleteFromR2(oldPdf);
  } else {
    await Quotation.create({ ...data, number: quoteNumber(input.date.slice(0, 4), await nextSeq("quote")) });
    // First quotation moves an early-stage lead to "Quotation Sent"; later stages are left alone.
    await Lead.updateOne({ leadId: lead.leadId, status: { $in: ["New", "Connected", "Interested"] } }, { status: "Quotation Sent" });
    revalidatePath("/leads");
  }
  await writeAudit(user.username, existing ? "quotation.updated" : "quotation.created", { lead: lead.leadId });
  revalidatePath("/quotations");
  redirect("/quotations");
}

export async function deleteQuotationAction(id: string): Promise<ActionState> {
  const user = await requireAction("quotations.manage");
  await connectDb();
  const quote = await Quotation.findOne({ _id: id, ...ownerScope(user) }).select("number leadId pdfUrl").lean();
  if (!quote) return fail("Quotation not found.");
  if (await Payment.exists({ quoteId: quote._id }) || await Invoice.exists({ quoteId: quote._id })) {
    return fail("This quotation has payment or receipt records, so it cannot be deleted.");
  }
  await Quotation.deleteOne({ _id: quote._id });
  if (quote.pdfUrl) await deleteFromR2(quote.pdfUrl);
  await writeAudit(user.username, "quotation.deleted", { lead: quote.leadId, number: quote.number });
  revalidatePath("/quotations");
  revalidatePath("/leads");
  return done("Quotation deleted.");
}
