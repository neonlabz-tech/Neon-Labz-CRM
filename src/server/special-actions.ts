"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { nextSeq } from "@/lib/counters";
import { connectDb } from "@/lib/db";
import { done, fail, invalid } from "@/lib/form";
import { quoteFigures } from "@/lib/money";
import { cleanRich, richHasText } from "@/lib/rich-text";
import { infoSchema } from "@/schemas/marketing";
import { specialClientSchema, specialProposalSchema, specialQuoteSchema, specialSrsSchema } from "@/schemas/special";
import { SOCIALS } from "@/lib/marketing";
import { seal } from "@/lib/secrets";
import { SpecialClient, SpecialDoc, type SpecialKind } from "@/models/special";
import type { ActionState } from "@/types";

const PREFIX: Record<SpecialKind, string> = { quotation: "SC-Q", proposal: "SC-P", srs: "SC-SRS" };

function refresh() {
  revalidatePath("/special-clients", "layout");
  revalidatePath("/dashboard");
}

async function numberFor(kind: SpecialKind) {
  return `${PREFIX[kind]}-${String(await nextSeq(`special-${kind}`)).padStart(4, "0")}`;
}

/* ---------- Clients ---------- */

export async function saveSpecialClientAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("special.manage");
  const parsed = specialClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  if (id) {
    if (!isValidObjectId(id)) return fail("That client was not found.");
    const result = await SpecialClient.updateOne({ _id: id }, data);
    if (!result.matchedCount) return fail("That client was not found.");
    // Documents keep the client's name as it was written, so a rename is copied to them.
    await SpecialDoc.updateMany({ clientId: id }, { clientName: data.name });
    await writeAudit(user.username, "special.client.updated", { id, name: data.name });
    refresh();
    return done("Client saved.");
  }
  const code = `SC-${String(await nextSeq("special-client")).padStart(3, "0")}`;
  await SpecialClient.create({ ...data, code });
  await writeAudit(user.username, "special.client.created", { code, name: data.name });
  refresh();
  return done(`${data.name} added as ${code}.`);
}

export async function deleteSpecialClientAction(id: string): Promise<ActionState> {
  const user = await requireAction("special.manage");
  if (!isValidObjectId(id)) return fail("That client was not found.");
  await connectDb();
  const client = await SpecialClient.findByIdAndDelete(id).select("name code").lean();
  if (!client) return fail("That client was not found.");
  const docs = await SpecialDoc.deleteMany({ clientId: id });
  await writeAudit(user.username, "special.client.deleted", { code: client.code, name: client.name, documents: docs.deletedCount });
  refresh();
  return done(docs.deletedCount ? `${client.name} and ${docs.deletedCount} document${docs.deletedCount === 1 ? "" : "s"} deleted.` : `${client.name} deleted.`);
}

/* ---------- Client info ---------- */

/** The same form as the marketing client info. Its "client code" holds the special client's id. */
export async function saveSpecialInfoAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("special.manage");
  const parsed = infoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { clientCode: clientId, ...fields } = parsed.data;
  if (!isValidObjectId(clientId)) return fail("Choose a client.");
  await connectDb();
  const client = await SpecialClient.findById(clientId).select("info").lean();
  if (!client) return fail("That client was not found.");
  const old = ((client.info ?? {}) as { social?: Record<string, { password?: string }> }).social ?? {};
  const social: Record<string, { username: string; password: string; pageLink: string }> = {};
  for (const key of SOCIALS) {
    const typed = String(formData.get(`social_${key}_password`) ?? "").trim();
    social[key] = {
      username: String(formData.get(`social_${key}_username`) ?? "").trim().slice(0, 200),
      pageLink: String(formData.get(`social_${key}_pageLink`) ?? "").trim().slice(0, 300),
      password: typed ? seal(typed) : old[key]?.password ?? "",
    };
  }
  await SpecialClient.updateOne({ _id: clientId }, { info: { ...fields, social }, infoSaved: true });
  await writeAudit(user.username, "special.info.saved", { clientId });
  refresh();
  return done("Client info saved.");
}

export async function clearSpecialInfoAction(id: string): Promise<ActionState> {
  const user = await requireAction("special.manage");
  if (!isValidObjectId(id)) return fail("That client was not found.");
  await connectDb();
  const result = await SpecialClient.updateOne({ _id: id }, { info: {}, infoSaved: false });
  if (!result.matchedCount) return fail("That client was not found.");
  await writeAudit(user.username, "special.info.cleared", { id });
  refresh();
  return done("Client info removed.");
}

/* ---------- Quotations ---------- */

export async function saveSpecialQuoteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("special.manage");
  const parsed = specialQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, clientId, lines, discount, terms, ...rest } = parsed.data;
  if (!isValidObjectId(clientId)) return fail("Choose a client.");
  await connectDb();
  const client = await SpecialClient.findById(clientId).select("name").lean();
  if (!client) return fail("That client was not found.");
  const figures = quoteFigures(lines.reduce((sum, line) => sum + line.price, 0), discount);
  const data = {
    ...rest,
    clientId,
    clientName: client.name,
    items: lines.map((line) => ({ name: line.name, price: line.price, scope: richHasText(line.scope) ? cleanRich(line.scope) : "" })),
    subtotal: figures.subtotal,
    discountPercent: figures.discountPercent,
    discount: figures.discount,
    total: figures.total,
    body: richHasText(terms) ? cleanRich(terms) : "As agreed with the client.",
  };
  if (id) {
    if (!isValidObjectId(id)) return fail("That quotation was not found.");
    const result = await SpecialDoc.updateOne({ _id: id, kind: "quotation" }, data);
    if (!result.matchedCount) return fail("That quotation was not found.");
    await writeAudit(user.username, "special.quotation.updated", { id });
    refresh();
    return done("Quotation saved.");
  }
  const number = await numberFor("quotation");
  await SpecialDoc.create({ ...data, kind: "quotation", number });
  await writeAudit(user.username, "special.quotation.created", { number, client: client.name });
  refresh();
  return done(`Quotation ${number} created.`);
}

/* ---------- Proposals and SRS documents ---------- */

/** Both use the project-report forms; their fields are kept together in `data` and the PDF is made from them. */
async function saveStructured(kind: "proposal" | "srs", input: Record<string, unknown>): Promise<ActionState> {
  const user = await requireAction("special.manage");
  const { id, clientId, title, date, ...data } = input as { id?: string; clientId: string; title: string; date: string } & Record<string, unknown>;
  if (!isValidObjectId(clientId)) return fail("Choose a client.");
  await connectDb();
  const client = await SpecialClient.findById(clientId).select("name").lean();
  if (!client) return fail("That client was not found.");
  const row = { title, date: date || new Date().toISOString().slice(0, 10), clientId, clientName: client.name, data };
  if (id) {
    if (!isValidObjectId(id)) return fail("That document was not found.");
    const result = await SpecialDoc.updateOne({ _id: id, kind }, row);
    if (!result.matchedCount) return fail("That document was not found.");
    await writeAudit(user.username, `special.${kind}.updated`, { id });
    refresh();
    return done("Document saved.");
  }
  const number = await numberFor(kind);
  await SpecialDoc.create({ ...row, kind, number });
  await writeAudit(user.username, `special.${kind}.created`, { number, client: client.name });
  refresh();
  return done(`${number} created.`);
}

export async function saveSpecialProposalAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAction("special.manage");
  const parsed = specialProposalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  return saveStructured("proposal", parsed.data);
}

export async function saveSpecialSrsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAction("special.manage");
  const parsed = specialSrsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  return saveStructured("srs", parsed.data);
}

export async function deleteSpecialDocAction(id: string): Promise<ActionState> {
  const user = await requireAction("special.manage");
  if (!isValidObjectId(id)) return fail("That document was not found.");
  await connectDb();
  const doc = await SpecialDoc.findByIdAndDelete(id).select("number kind").lean();
  if (!doc) return fail("That document was not found.");
  await writeAudit(user.username, `special.${doc.kind}.deleted`, { number: doc.number });
  refresh();
  return done(`${doc.number} deleted.`);
}
