"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodType } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { done, fail, invalid } from "@/lib/form";
import { deleteFromR2 } from "@/lib/r2";
import { isId, visibleProjectFilter } from "@/lib/project-access";
import { DemoVideo, Proposal, Srs } from "@/models/report";
import { Project } from "@/models/project";
import { proposalSchema, srsSchema, videoSchema } from "@/schemas/report";
import type { ActionState } from "@/types";

type Kind = "srs" | "proposal" | "video";
const KINDS: Record<Kind, { path: string; label: string }> = {
  srs: { path: "/reports", label: "SRS document" },
  proposal: { path: "/reports/proposals", label: "Proposal" },
  video: { path: "/reports/videos", label: "Demo video" },
};

type Data = { projectCode: string } & Record<string, unknown>;
type Ops = {
  pdf: (id: string, owner: string) => Promise<{ pdfUrl?: string } | null>;
  update: (id: string, owner: string, data: Data) => Promise<{ matchedCount: number }>;
  create: (owner: string, data: Data) => Promise<unknown>;
  remove: (id: string, owner: string) => Promise<{ deletedCount: number }>;
};
const OPS: Record<Kind, Ops> = {
  srs: { pdf: (id, owner) => Srs.findOne({ _id: id, owner }).select("pdfUrl").lean(), update: (id, owner, d) => Srs.updateOne({ _id: id, owner }, d), create: (owner, d) => Srs.create({ ...d, owner }), remove: (id, owner) => Srs.deleteOne({ _id: id, owner }) },
  proposal: { pdf: (id, owner) => Proposal.findOne({ _id: id, owner }).select("pdfUrl").lean(), update: (id, owner, d) => Proposal.updateOne({ _id: id, owner }, d), create: (owner, d) => Proposal.create({ ...d, owner }), remove: (id, owner) => Proposal.deleteOne({ _id: id, owner }) },
  video: { pdf: (id, owner) => DemoVideo.findOne({ _id: id, owner }).select("pdfUrl").lean(), update: (id, owner, d) => DemoVideo.updateOne({ _id: id, owner }, d), create: (owner, d) => DemoVideo.create({ ...d, owner }), remove: (id, owner) => DemoVideo.deleteOne({ _id: id, owner }) },
};

async function save(kind: Kind, schema: ZodType<Data & { id?: string }>, formData: FormData): Promise<ActionState> {
  const user = await requireAction("reports.manage");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  if (!(await Project.exists({ code: data.projectCode, archived: false, ...(await visibleProjectFilter(user)) }))) {
    return { ok: false, message: "Choose a project from the list.", errors: { projectCode: "Choose a project from the list." } };
  }
  if (id) {
    const old = isId(id) ? await OPS[kind].pdf(id, user.username) : null;
    const result = isId(id) ? await OPS[kind].update(id, user.username, { ...data, pdfUrl: "" }) : { matchedCount: 0 };
    if (!result.matchedCount) return fail(`That ${KINDS[kind].label.toLowerCase()} was not found.`);
    if (old?.pdfUrl) await deleteFromR2(old.pdfUrl);
  } else {
    await OPS[kind].create(user.username, data);
  }
  await writeAudit(user.username, `report.${kind}.${id ? "updated" : "created"}`, { project: data.projectCode });
  revalidatePath("/reports", "layout");
  redirect(KINDS[kind].path);
}

async function remove(kind: Kind, id: string): Promise<ActionState> {
  const user = await requireAction("reports.manage");
  await connectDb();
  const old = isId(id) ? await OPS[kind].pdf(id, user.username) : null;
  const result = isId(id) ? await OPS[kind].remove(id, user.username) : { deletedCount: 0 };
  if (!result.deletedCount) return fail(`That ${KINDS[kind].label.toLowerCase()} was not found.`);
  if (old?.pdfUrl) await deleteFromR2(old.pdfUrl);
  await writeAudit(user.username, `report.${kind}.deleted`, { id });
  revalidatePath("/reports", "layout");
  return done(`${KINDS[kind].label} deleted.`);
}

export async function saveSrsAction(_: ActionState, formData: FormData) { return save("srs", srsSchema, formData); }
export async function saveProposalAction(_: ActionState, formData: FormData) { return save("proposal", proposalSchema, formData); }
export async function saveVideoAction(_: ActionState, formData: FormData) { return save("video", videoSchema, formData); }
export async function deleteSrsAction(id: string) { return remove("srs", id); }
export async function deleteProposalAction(id: string) { return remove("proposal", id); }
export async function deleteVideoAction(id: string) { return remove("video", id); }
