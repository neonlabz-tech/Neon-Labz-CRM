"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { clientCode, leadId, nextSeq } from "@/lib/counters";
import { dateIsAllowed, todayISO } from "@/lib/dates";
import { readLeadCsv, type CsvLead } from "@/lib/lead-csv";
import { done, fail, invalid } from "@/lib/form";
import { notifyUsers } from "@/lib/notify";
import { ownerScope } from "@/lib/permissions";
import { EMAIL_ERROR, PHONE_ERROR, PHONE_TAKEN, formatPhone, phoneDigits, validEmail, validSriLankanPhone } from "@/lib/phone";
import { leadSchema } from "@/schemas/lead";
import { Lead } from "@/models/lead";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";
import { User } from "@/models/user";
import type { ActionState } from "@/types";

const field = (name: string, message: string): ActionState => ({ ok: false, message, errors: { [name]: message } });

export async function saveLeadAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("leads.manage");
  const raw = Object.fromEntries(formData);
  for (const key of ["callOutcome", "callStatus", "status"]) if (raw[key] === "") delete raw[key];
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  await connectDb();
  const existing = input.id ? await Lead.findOne({ leadId: input.id, ...ownerScope(user) }) : null;
  if (input.id && !existing) {
    await writeAudit(user.username, "permission.denied", { action: "lead.edit", lead: input.id });
    return fail("Lead not found.");
  }
  if (!dateIsAllowed(input.date, existing?.date ?? "")) return field("date", "Lead date cannot be before today.");

  const phone = formatPhone(input.phone);
  const digits = phoneDigits(phone);
  if (digits && !validSriLankanPhone(phone)) return field("phone", PHONE_ERROR);
  if (digits.length === 10 && digits !== existing?.phoneDigits && (await Lead.exists({ phoneDigits: digits, leadId: { $ne: existing?.leadId ?? "" } }))) {
    return field("phone", PHONE_TAKEN);
  }
  if (input.email && !validEmail(input.email)) return field("email", EMAIL_ERROR);

  const picked = existing ? input.status ?? existing.status : "New";
  if (input.callNext && !dateIsAllowed(input.callNext)) return field("callNext", "Next follow-up date cannot be before today.");

  const logging = Boolean(input.callOutcome);
  const unanswered = input.callOutcome === "Not Answered";
  const status = logging ? (unanswered ? existing?.status ?? picked : input.callStatus ?? picked) : picked;

  if (status === "Converted" && (!input.address || !digits)) {
    return field("status", "Enter a Sri Lankan phone number and address before marking Converted.");
  }
  if (existing?.clientCode && status !== "Converted") {
    const used = (await Quotation.exists({ leadId: existing.leadId })) || (await Payment.exists({ leadId: existing.leadId }));
    if (used) return field("status", "This client already has a quotation or payment, so it must stay Converted.");
  }

  const call = logging
    ? { date: todayISO(), outcome: input.callOutcome, status, next: input.callNext, note: input.callNote, createdAt: new Date() }
    : null;

  const base = {
    date: input.date, business: input.business, phone, phoneDigits: digits, email: input.email, address: input.address,
    businessType: input.businessType, source: input.source, service: input.service, notes: input.notes, status,
    next: call?.next || existing?.next || "",
    ...(call ? { latestFollowUpAt: new Date() } : {}),
  };
  const code = status === "Converted" ? existing?.clientCode || clientCode(await nextSeq("client")) : "";

  try {
    if (existing) {
      Object.assign(existing, base, { clientCode: code });
      if (call) existing.calls.push(call);
      await existing.save();
    } else {
      const created = await Lead.create({ ...base, leadId: leadId(await nextSeq("lead")), owner: user.username, clientCode: code, calls: call ? [call] : [] });
      await writeAudit(user.username, "lead.created", { lead: created.leadId });
    }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return field("phone", PHONE_TAKEN);
    throw error;
  }
  // A quotation made before conversion carries the client code and name once they exist.
  if (existing) await Quotation.updateOne({ leadId: existing.leadId }, { client: input.business, ...(code ? { clientCode: code } : {}) });
  revalidatePath("/leads");
  redirect(user.role === "superadmin" ? "/leads?own=1" : "/leads");
}

export async function deleteLeadAction(id: string): Promise<ActionState> {
  const user = await requireAction("leads.delete");
  await connectDb();
  const lead = await Lead.findOne({ leadId: id, ...ownerScope(user) }).select("leadId").lean();
  if (!lead) return fail("Lead not found.");
  if (await Quotation.exists({ leadId: id })) return fail("This lead already has a quotation. Remove the quotation first.");
  if (await Payment.exists({ leadId: id })) return fail("This lead already has a payment. Cancel the payment first.");
  await Lead.deleteOne({ leadId: id });
  await writeAudit(user.username, "lead.deleted", { lead: id });
  revalidatePath("/leads");
  return done("Lead deleted.");
}

/** The Super Admin hands a lead (and its quotation) to another active salesperson. */
export async function assignLeadAction(id: string, username: string): Promise<ActionState> {
  const user = await requireAction("sales.targets");
  await connectDb();
  const [lead, seller] = await Promise.all([Lead.findOne({ leadId: id }).select("leadId business owner").lean(), User.findOne({ username, role: "sales", active: true }).select("username").lean()]);
  if (!lead) return fail("Lead not found.");
  if (!seller) return fail("Choose an active salesperson.");
  if (lead.owner === username) return done("Already assigned to this salesperson.");
  await Promise.all([Lead.updateOne({ leadId: id }, { owner: username }), Quotation.updateMany({ leadId: id }, { owner: username })]);
  await notifyUsers([username], `The Super Admin assigned ${lead.business} (${id}) to you.`, `/leads/${id}`);
  await writeAudit(user.username, "lead.assigned", { lead: id, from: lead.owner, to: username });
  revalidatePath("/leads");
  revalidatePath("/quotations");
  return done(`${id} assigned to ${username}.`);
}

const MAX_CSV = 1024 * 1024;
const MAX_ROWS = 500;

type ReadyLead = { line: number; lead: Omit<CsvLead, "owner">; owner: string; digits: string };

/** Reads the CSV and works out which rows can be added, to whom, and which are skipped and why. Nothing is saved. */
async function planImport(user: { username: string }, formData: FormData): Promise<{ error: string } | { ready: ReadyLead[]; problems: string[] }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > MAX_CSV) return { error: "The CSV file is too large. Keep it under 1 MB." };
  const read = readLeadCsv(await file.text(), todayISO());
  if (read.error) return { error: read.error };
  if (read.leads.length > MAX_ROWS) return { error: `Import up to ${MAX_ROWS} leads at a time.` };

  await connectDb();
  const sellers = await User.find({ role: "sales", active: true }).select("username").lean();
  const allowed = new Set([user.username, ...sellers.map((s) => s.username)]);
  const chosen = String(formData.get("owner") ?? "").trim().toUpperCase();
  if (chosen && !allowed.has(chosen)) return { error: "Choose an active salesperson." };
  const fallback = chosen || user.username;

  const names = new Set((await Lead.find({ owner: { $in: [...allowed] } }).select("business owner").lean()).map((l) => `${l.owner}|${l.business.trim().toLowerCase()}`));
  const phones = new Set((await Lead.find({ phoneDigits: { $ne: "" } }).select("phoneDigits").lean()).map((l) => l.phoneDigits));
  const problems = [...read.problems];
  const ready: ReadyLead[] = [];
  for (const { line, lead: { owner: wanted, ...lead } } of read.leads) {
    const owner = wanted.trim().toUpperCase() || fallback;
    if (!allowed.has(owner)) { problems.push(`Row ${line} (${lead.business}): ${owner} is not an active salesperson.`); continue; }
    const digits = phoneDigits(lead.phone);
    const key = `${owner}|${lead.business.toLowerCase()}`;
    if (names.has(key) || (digits && phones.has(digits))) { problems.push(`Row ${line} (${lead.business}) matches an existing lead.`); continue; }
    if (lead.email && !validEmail(lead.email)) { problems.push(`Row ${line} (${lead.business}): ${EMAIL_ERROR}`); continue; }
    if (lead.status === "Converted" && (!lead.address || !digits)) { problems.push(`Row ${line} (${lead.business}): a Converted lead needs a Sri Lankan phone number and an address.`); continue; }
    names.add(key);
    if (digits) phones.add(digits);
    ready.push({ line, lead, owner, digits });
  }
  return { ready, problems };
}

/** Checks a CSV file without saving anything, so the window can say how many leads it will add. */
export async function previewLeadsAction(formData: FormData): Promise<{ ok: boolean; count: number; problems: string[]; error?: string }> {
  const user = await requireAction("leads.delete");
  const plan = await planImport(user, formData);
  if ("error" in plan) return { ok: false, count: 0, problems: [], error: plan.error };
  return { ok: true, count: plan.ready.length, problems: plan.problems };
}

/** Adds leads from a CSV file. A row that repeats a name or phone already in the system is skipped and reported. */
export async function importLeadsAction(formData: FormData): Promise<ActionState> {
  const user = await requireAction("leads.delete");
  const plan = await planImport(user, formData);
  if ("error" in plan) return fail(plan.error);
  const { ready, problems } = plan;
  if (!ready.length) return fail(problems.join(" ") || "No leads were imported.");
  for (const { lead, owner, digits } of ready) {
    const code = lead.status === "Converted" ? clientCode(await nextSeq("client")) : "";
    await Lead.create({ ...lead, phoneDigits: digits, leadId: leadId(await nextSeq("lead")), owner, clientCode: code, calls: [] });
  }
  const own = ready.filter((r) => r.owner === user.username).length;
  await writeAudit(user.username, "lead.imported", { count: ready.length, skipped: problems.length });
  revalidatePath("/leads");
  const where = own === ready.length ? " They are under Own projects." : own ? ` ${own} are under Own projects, the rest went to salespeople.` : " They went to the salespeople.";
  return done(`Imported ${ready.length} lead${ready.length === 1 ? "" : "s"}.${where}${problems.length ? ` Skipped ${problems.length}: ${problems.slice(0, 5).join(" ")}${problems.length > 5 ? " …" : ""}` : ""}`);
}

/** Deletes the chosen leads. A lead with a quotation or payment is kept and reported. */
export async function deleteLeadsAction(ids: string[]): Promise<ActionState> {
  const user = await requireAction("leads.manage");
  const wanted = [...new Set(ids.filter((id) => typeof id === "string" && /^LEAD-\d+$/.test(id)))].slice(0, 200);
  if (!wanted.length) return fail("Choose at least one lead.");
  await connectDb();
  const mine = (await Lead.find({ leadId: { $in: wanted }, ...ownerScope(user) }).select("leadId").lean()).map((l) => l.leadId);
  const [quoted, paid] = await Promise.all([Quotation.distinct("leadId", { leadId: { $in: mine } }), Payment.distinct("leadId", { leadId: { $in: mine } })]);
  const locked = new Set([...quoted, ...paid]);
  const removable = mine.filter((id) => !locked.has(id));
  if (removable.length) await Lead.deleteMany({ leadId: { $in: removable } });
  await writeAudit(user.username, "lead.deleted.bulk", { count: removable.length });
  revalidatePath("/leads");
  if (!removable.length) return fail("None of these leads can be deleted. They already have a quotation or payment.");
  return done(`Deleted ${removable.length} lead${removable.length === 1 ? "" : "s"}.${locked.size ? ` ${locked.size} kept because they have a quotation or payment.` : ""}`);
}
