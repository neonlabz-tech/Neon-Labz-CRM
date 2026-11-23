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
import { callEntrySchema, leadSchema } from "@/schemas/lead";
import { Lead } from "@/models/lead";
import { Invoice } from "@/models/invoice";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";
import { deleteFromR2 } from "@/lib/r2";
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
  // The lead date is always the day the lead was added; nobody can change it.
  const leadDate = existing?.date || todayISO();

  const phone = formatPhone(input.phone);
  const digits = phoneDigits(phone);
  if (!digits) return field("phone", "Phone is required.");
  if (!validSriLankanPhone(phone)) return field("phone", PHONE_ERROR);
  if (digits.length === 10 && digits !== existing?.phoneDigits && (await Lead.exists({ phoneDigits: digits, leadId: { $ne: existing?.leadId ?? "" } }))) {
    return field("phone", PHONE_TAKEN);
  }
  if (!input.email) return field("email", "Email is required.");
  if (!validEmail(input.email)) return field("email", EMAIL_ERROR);

  const picked = existing ? input.status ?? existing.status : "New";
  if (input.callNext && !dateIsAllowed(input.callNext)) return field("callNext", "Next follow-up date cannot be before today.");

  // A new lead can be added without a call; calls are logged afterwards from the follow-up window.
  const logging = !existing && Boolean(input.callOutcome);
  const unanswered = input.callOutcome === "Not Answered";
  const status = logging ? (unanswered ? picked : input.callStatus ?? picked) : picked;

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
    date: leadDate, business: input.business, phone, phoneDigits: digits, email: input.email, address: input.address,
    businessType: input.businessType, source: input.source, service: input.service, notes: input.notes, status,
    next: call?.next || existing?.next || "",
    ...(call ? { latestFollowUpAt: new Date() } : {}),
  };
  // A lead the Super Admin adds from "Own projects" stays in that area; the SD list is the sales team only.
  const own = user.role === "superadmin" && formData.get("own") === "1";
  const code = status === "Converted" ? existing?.clientCode || clientCode(await nextSeq("client")) : "";

  try {
    if (existing) {
      Object.assign(existing, base, { clientCode: code });
      if (call) existing.calls.push(call);
      await existing.save();
    } else {
      const created = await Lead.create({ ...base, leadId: leadId(await nextSeq("lead")), owner: user.username, own, clientCode: code, calls: call ? [call] : [] });
      await writeAudit(user.username, "lead.created", { lead: created.leadId });
    }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return field("phone", PHONE_TAKEN);
    throw error;
  }
  // A quotation made before conversion carries the client code and name once they exist.
  if (existing) await Quotation.updateOne({ leadId: existing.leadId }, { client: input.business, ...(code ? { clientCode: code } : {}) });
  revalidatePath("/leads");
  // Editing happens in a window (or on the lead page) and stays where it is; only a new lead goes back to the list.
  if (existing) {
    revalidatePath(`/leads/${existing.leadId}`);
    return done("Lead saved.");
  }
  redirect(own ? "/leads?own=1" : "/leads");
}

export async function deleteLeadAction(id: string): Promise<ActionState> {
  const user = await requireAction("leads.delete");
  await connectDb();
  const lead = await Lead.findOne({ leadId: id, ...ownerScope(user) }).select("leadId").lean();
  if (!lead) return fail("Lead not found.");
  const quote = await Quotation.findOne({ leadId: id }).select("_id number pdfUrl").lean();
  if (quote && (await Payment.exists({ quoteId: quote._id }) || await Invoice.exists({ quoteId: quote._id }))) {
    return fail("This lead has payment or receipt records, so it cannot be deleted. Its quotation is kept.");
  }
  if (quote) {
    await Quotation.deleteOne({ _id: quote._id });
    if (quote.pdfUrl) await deleteFromR2(quote.pdfUrl);
  } else if (await Payment.exists({ leadId: id })) {
    return fail("This lead has payment records, so it cannot be deleted.");
  }
  await Lead.deleteOne({ leadId: id });
  await writeAudit(user.username, "lead.deleted", { lead: id });
  revalidatePath("/leads");
  revalidatePath("/quotations");
  return done(quote ? "Lead and its quotation deleted." : "Lead deleted.");
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
  const quotes = await Quotation.find({ leadId: { $in: mine } }).select("leadId _id pdfUrl").lean();
  const quoteIds = quotes.map((quote) => quote._id);
  const [paid, invoiced] = await Promise.all([
    Payment.distinct("leadId", { leadId: { $in: mine } }),
    quoteIds.length ? Invoice.distinct("quoteId", { quoteId: { $in: quoteIds } }) : Promise.resolve([]),
  ]);
  const protectedQuotes = new Set(invoiced.map(String));
  const locked = new Set([
    ...paid,
    ...quotes.filter((quote) => protectedQuotes.has(String(quote._id))).map((quote) => quote.leadId),
  ]);
  const removable = mine.filter((id) => !locked.has(id));
  const removableQuotes = quotes.filter((quote) => removable.includes(quote.leadId));
  if (removable.length) {
    await Quotation.deleteMany({ leadId: { $in: removable } });
    await Lead.deleteMany({ leadId: { $in: removable } });
    await Promise.all(removableQuotes.map((quote) => quote.pdfUrl ? deleteFromR2(quote.pdfUrl) : Promise.resolve()));
  }
  await writeAudit(user.username, "lead.deleted.bulk", { count: removable.length });
  revalidatePath("/leads");
  revalidatePath("/quotations");
  if (!removable.length) return fail("None of these leads can be deleted. They have payment or receipt records.");
  return done(`Deleted ${removable.length} lead${removable.length === 1 ? "" : "s"}${removableQuotes.length ? ` and ${removableQuotes.length} quotation${removableQuotes.length === 1 ? "" : "s"}` : ""}.${locked.size ? ` ${locked.size} kept because they have payment or receipt records.` : ""}`);
}

/** Live check while a phone number is typed: is it already on another lead? */
export async function phoneTakenAction(phone: string, leadId: string): Promise<{ taken: boolean; message: string }> {
  await requireAction("leads.manage");
  const digits = phoneDigits(String(phone ?? ""));
  if (digits.length !== 10) return { taken: false, message: "" };
  await connectDb();
  const other = await Lead.findOne({ phoneDigits: digits, leadId: { $ne: String(leadId ?? "") } }).select("leadId").lean();
  if (!other) return { taken: false, message: "" };
  return { taken: true, message: "This phone number is already added as another lead." };
}

type StageLead = { leadId: string; status: string; address: string; phoneDigits: string; clientCode: string };

/** Checks a stage change and works out the client code that goes with it. */
async function stageChange(lead: StageLead, status: string): Promise<{ error: string } | { code: string }> {
  if (status === lead.status) return { code: lead.clientCode };
  if (status === "Converted" && (!lead.address || !lead.phoneDigits)) return { error: "Enter a Sri Lankan phone number and address before marking Converted." };
  if (lead.clientCode && status !== "Converted") {
    const used = (await Quotation.exists({ leadId: lead.leadId })) || (await Payment.exists({ leadId: lead.leadId }));
    if (used) return { error: "This client already has a quotation or payment, so it must stay Converted." };
  }
  return { code: status === "Converted" ? lead.clientCode || clientCode(await nextSeq("client")) : "" };
}

function readCall(formData: FormData) {
  const raw = Object.fromEntries(formData);
  for (const key of ["callStatus", "callOutcome"]) if (raw[key] === "") delete raw[key];
  return callEntrySchema.safeParse(raw);
}

function refreshLead(id: string) {
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

/** Adds one more call to a lead. A call that was not answered counts as a follow-up and leaves the stage as it is. */
export async function addCallAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("leads.manage");
  const parsed = readCall(formData);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  await connectDb();
  const lead = await Lead.findOne({ leadId: input.leadId, ...ownerScope(user) });
  if (!lead) return fail("Lead not found.");
  if (input.callNext && !dateIsAllowed(input.callNext)) return field("callNext", "Next follow-up date cannot be before today.");
  const status = input.callOutcome === "Not Answered" ? lead.status : input.callStatus ?? lead.status;
  const moved = await stageChange(lead, status);
  if ("error" in moved) return field("callStatus", moved.error);
  lead.status = status as typeof lead.status;
  lead.clientCode = moved.code;
  lead.calls.push({ date: todayISO(), outcome: input.callOutcome, status: status as typeof lead.status, next: input.callNext, note: input.callNote, createdAt: new Date() });
  if (input.callNext) lead.next = input.callNext;
  lead.latestFollowUpAt = new Date();
  await lead.save();
  if (moved.code) await Quotation.updateOne({ leadId: lead.leadId }, { client: lead.business, clientCode: moved.code });
  await writeAudit(user.username, "lead.call.added", { lead: lead.leadId, outcome: input.callOutcome });
  refreshLead(lead.leadId);
  return done("Call logged.");
}

/** Edits one entry of the call history. Only the latest entry can change the stage. */
export async function updateCallAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("leads.manage");
  const parsed = readCall(formData);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  await connectDb();
  const lead = await Lead.findOne({ leadId: input.leadId, ...ownerScope(user) });
  const entry = lead && input.index !== undefined ? lead.calls[input.index] : undefined;
  if (!lead || !entry || input.index === undefined) return fail("Call not found.");
  if (input.callNext && !dateIsAllowed(input.callNext, entry.next ?? "")) return field("callNext", "Next follow-up date cannot be before today.");
  const latest = input.index === lead.calls.length - 1;
  const restage = latest && input.callOutcome === "Answered";
  const status = restage ? input.callStatus ?? entry.status : entry.status;
  if (restage) {
    const moved = await stageChange(lead, status);
    if ("error" in moved) return field("callStatus", moved.error);
    lead.status = status as typeof lead.status;
    lead.clientCode = moved.code;
    if (moved.code) await Quotation.updateOne({ leadId: lead.leadId }, { client: lead.business, clientCode: moved.code });
  }
  if (latest) lead.next = input.callNext;
  entry.outcome = input.callOutcome;
  entry.status = status as typeof entry.status;
  entry.next = input.callNext;
  entry.note = input.callNote;
  lead.markModified("calls");
  await lead.save();
  await writeAudit(user.username, "lead.call.edited", { lead: lead.leadId, index: input.index });
  refreshLead(lead.leadId);
  return done("Call updated.");
}
