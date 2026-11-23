"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { clientCode, nextSeq } from "@/lib/counters";
import { manualSaleCode } from "@/lib/counters-format";
import { done, fail, invalid } from "@/lib/form";
import { cents, formatMoney, round2 } from "@/lib/money";
import { notifyRole } from "@/lib/notify";
import { workTypeOf } from "@/lib/work-type";
import { escapeRegex } from "@/lib/pagination";
import { isId } from "@/lib/project-access";
import { manualSaleSchema, salePaymentSchema } from "@/schemas/manual-sale";
import { Client } from "@/models/client";
import { MANUAL_SALE_STATUSES, ManualSale, UNASSIGNED } from "@/models/manual-sale";
import { Project } from "@/models/project";
import { Package } from "@/models/package";
import { User } from "@/models/user";
import type { ActionState } from "@/types";

function refresh() {
  for (const path of ["/approvals", "/sales-reports", "/sales-overview", "/dashboard", "/clients"]) revalidatePath(path);
}

/**
 * A confirmed sale makes its client a client and tells whoever will do the work.
 * The client is found by name, so a second sale for the same client does not create a second record.
 */
async function joinPayingClients(sale: { _id: unknown; saleCode: string; business: string; service: string; owner: string; goesTo: string; guest?: boolean }, adminName: string) {
  const workType = sale.goesTo === "marketing" ? "marketing" : sale.goesTo === "both" ? "both" : sale.goesTo === "project" ? "software" : workTypeOf(sale.service);
  const known = await Client.findOne({ name: new RegExp(`^${escapeRegex(sale.business)}$`, "i") }).select("code workType leadId ownOnly").lean();
  let code = known?.code ?? "";
  if (!code) {
    code = clientCode(await nextSeq("client"));
    await Client.create({
      code, name: sale.business, service: sale.service, workType, leadId: sale.saleCode,
      // A sale the Super Admin keeps for themselves shows under "Own projects".
      salesOwner: sale.owner !== UNASSIGNED ? sale.owner : sale.goesTo === "own" ? adminName : UNASSIGNED,
      ownOnly: sale.goesTo === "own",
      guest: Boolean(sale.guest),
    });
  } else if (sale.goesTo === "own") {
    // Only a client this very sale made can be kept private; a client who already paid through the normal flow stays visible.
    if (known?.leadId === sale.saleCode) await Client.updateOne({ code }, { ownOnly: true });
  } else if (known?.ownOnly) {
    await Client.updateOne({ code }, { ownOnly: false });
  }
  await ManualSale.updateOne({ _id: sale._id }, { clientCode: code });
  // A returning client who now buys the other kind of work becomes "both".
  if (known && known.workType !== workType && known.workType !== "both" && sale.goesTo !== "own") await Client.updateOne({ code }, { workType: known.workType && known.workType !== workType ? "both" : workType });
  const text = `${sale.business} is now a client. Open Clients to start the work.`;
  await notifyRole("superadmin", text, "/clients");
  if (sale.goesTo === "project" || sale.goesTo === "both") await notifyRole("pm", text, "/clients");
  if (sale.goesTo === "marketing" || sale.goesTo === "both") await notifyRole("marketing", text, "/clients");
}

/**
 * Money already collected when a sale is confirmed becomes its first receipt, so a sale that was paid in full
 * (or in part) at the start gets its bill without a separate "Add payment".
 */
async function openingReceipt(id: unknown) {
  const sale = await ManualSale.findById(id).select("saleCode collected date payments").lean();
  if (!sale || (sale.payments ?? []).length > 0 || sale.collected <= 0) return;
  await ManualSale.updateOne({ _id: id, "payments.0": { $exists: false } }, { $push: { payments: { receiptNo: `${sale.saleCode}-R1`, amount: sale.collected, date: sale.date, method: "", transactionId: "" } } });
}

export async function saveManualSaleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("payments.approve");
  const parsed = manualSaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, guest: guestFlag, ...fields } = parsed.data;
  const guest = guestFlag === "1";
  await connectDb();
  // A guest's service is one or more package names picked from the list or typed. An id from an older form is turned into the package's name.
  const single = guest && isId(fields.service) ? await Package.findOne({ _id: fields.service, status: "active" }).select("name").lean() : null;
  if (guest && isId(fields.service) && !single) {
    return { ok: false, message: "Choose an active package.", errors: { service: "Choose an active package from the list." } };
  }
  // "Add guest" records an existing client: no value, nothing collected, no salesperson, confirmed straight away.
  const data = guest ? { ...fields, service: single ? single.name : fields.service, owner: UNASSIGNED, amount: 0, collected: 0, status: "confirmed" as const } : fields;
  if (data.owner !== UNASSIGNED && !(await User.exists({ username: data.owner, role: "sales", active: true }))) return { ok: false, message: "Choose a salesperson.", errors: { owner: "Choose a salesperson from the list." } };

  // A guest is a client who is not in the system yet; a name that is already a client is refused so nobody is merged or switched by mistake.
  if (guest && !id) {
    const taken = await Client.findOne({ name: new RegExp(`^${escapeRegex(data.business)}$`, "i") }).select("code").lean();
    if (taken) {
      const message = `${data.business} is already a client (${taken.code}). Start its project from Clients.`;
      return { ok: false, message, errors: { business: message } };
    }
  }

  let saved: { _id: unknown; saleCode: string; clientCode: string; status: string; guest?: boolean } | null;
  let goesToChanged = false;
  if (id) {
    const before = isId(id) ? await ManualSale.findById(id).lean() : null;
    if (!before) return fail("That sale was not found.");
    if (before.guest) return fail("A guest client is managed from Leads, Guest.");
    if ((before.payments ?? []).length > 0 && data.status !== "confirmed") return { ok: false, message: "This sale has payments.", errors: { status: "A sale with payments must stay confirmed." } };
    // Once receipts exist, the collected total only changes through "Add payment".
    const collected = (before.payments ?? []).length > 0 ? before.collected : data.collected;
    if (cents(data.amount) < cents(collected)) return { ok: false, message: "The sale value is below what was collected.", errors: { amount: `The sale value can't be less than the ${formatMoney(before.collected)} already collected.` } };
    goesToChanged = before.goesTo !== data.goesTo;
    await ManualSale.updateOne({ _id: id }, { ...data, collected });
    saved = { _id: before._id, saleCode: before.saleCode, clientCode: before.clientCode, status: before.status, guest: Boolean(before.guest) };
  } else {
    const created = await ManualSale.create({ ...data, ...(guest ? { guest: true } : {}), payments: [], saleCode: manualSaleCode(await nextSeq("manualSale")) });
    saved = { _id: created._id, saleCode: created.saleCode, clientCode: "", status: "pending", guest };
  }
  if (data.status === "confirmed" && saved.status !== "confirmed") {
    await joinPayingClients({ ...saved, ...data }, admin.username);
    await openingReceipt(saved._id);
  } else if (data.status === "confirmed" && (goesToChanged || data.goesTo === "own")) {
    // The sale was confirmed earlier and "Goes to" changed since: show or hide the client for the right teams.
    await joinPayingClients({ ...saved, ...data }, admin.username);
  }
  await writeAudit(admin.username, id ? "sale.manual.updated" : "sale.manual.created", { business: data.business, amount: data.amount });
  refresh();
  if (guest) {
    revalidatePath("/leads");
    return done("Guest client added.");
  }
  redirect("/approvals?status=manual");
}

export async function setManualSaleStatusAction(id: string, status: string): Promise<ActionState> {
  const admin = await requireAction("payments.approve");
  if (!(MANUAL_SALE_STATUSES as readonly string[]).includes(status)) return fail("Choose a valid status.");
  await connectDb();
  const sale = isId(id) ? await ManualSale.findById(id).lean() : null;
  if (!sale) return fail("That sale was not found.");
  if ((sale.payments ?? []).length > 0 && status !== "confirmed") return fail("A sale with payments must stay confirmed.");
  await ManualSale.updateOne({ _id: id }, { status });
  if (status === "confirmed" && sale.status !== "confirmed") {
    await joinPayingClients(sale, admin.username);
    await openingReceipt(sale._id);
  }
  await writeAudit(admin.username, "sale.manual.status", { id, status });
  refresh();
  return done(status === "confirmed" ? `Confirmed. ${sale.business} is now a client.` : `Marked ${status}.`);
}

export async function deleteManualSaleAction(id: string): Promise<ActionState> {
  const admin = await requireAction("payments.approve");
  await connectDb();
  const sale = isId(id) ? await ManualSale.findById(id).select("payments").lean() : null;
  if (!sale) return fail("That sale was not found.");
  if ((sale.payments ?? []).length > 0) return fail("This sale already has receipts, so it can't be deleted.");
  await ManualSale.deleteOne({ _id: id });
  await writeAudit(admin.username, "sale.manual.deleted", { id });
  refresh();
  return done("Sale deleted.");
}

/** Removes a guest client added by mistake, together with its client record, unless a project was already started for it. */
export async function deleteGuestAction(id: string): Promise<ActionState> {
  const admin = await requireAction("payments.approve");
  await connectDb();
  const sale = isId(id) ? await ManualSale.findOne({ _id: id, guest: true }).select("business clientCode").lean() : null;
  if (!sale) return fail("That guest was not found.");
  if (sale.clientCode && (await Project.exists({ clientCode: sale.clientCode }))) return fail("A project was already started for this guest, so it can't be removed.");
  if (sale.clientCode) await Client.deleteOne({ code: sale.clientCode, guest: true });
  await ManualSale.deleteOne({ _id: sale._id });
  await writeAudit(admin.username, "sale.guest.deleted", { business: sale.business });
  refresh();
  revalidatePath("/leads");
  revalidatePath("/clients");
  return done("Guest removed.");
}

/** Adds one payment to a confirmed sale. Its receipt is made from it and the collected total goes up. */
export async function addSalePaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("payments.approve");
  const parsed = salePaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  await connectDb();
  const sale = isId(input.id) ? await ManualSale.findById(input.id).lean() : null;
  if (!sale) return fail("That sale was not found.");
  if (sale.status !== "confirmed") return fail("Confirm the sale before recording payments.");
  const amount = round2(input.amount);
  const balance = cents(sale.amount) - cents(sale.collected);
  if (cents(amount) > balance) return { ok: false, message: "The payment is more than the balance.", errors: { amount: `The balance is only ${formatMoney(balance / 100)}.` } };

  const receiptNo = `${sale.saleCode}-R${(sale.payments ?? []).length + 1}`;
  // Matching on the collected total means two payments saved at once cannot both pass the balance check.
  const result = await ManualSale.updateOne(
    { _id: sale._id, collected: sale.collected },
    { $push: { payments: { receiptNo, amount, date: input.date, method: input.method, transactionId: input.transactionId } }, $set: { collected: round2(sale.collected + amount) } }
  );
  if (!result.matchedCount) return fail("Another payment was just saved for this sale. Please try again.");
  await writeAudit(admin.username, "sale.manual.payment", { saleCode: sale.saleCode, receiptNo, amount });
  refresh();
  return done(cents(amount) === balance ? `${receiptNo} saved. ${sale.business} has paid in full.` : `${receiptNo} saved.`);
}
