"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { done, fail, invalid } from "@/lib/form";
import { REPORT_PLATFORMS, SOCIALS, STAT_KEYS } from "@/lib/marketing";
import { deleteFromR2 } from "@/lib/r2";
import { uploadFile } from "@/lib/uploads";
import { isId } from "@/lib/project-access";
import { seal } from "@/lib/secrets";
import { infoSchema, planSchema, reportSchema } from "@/schemas/marketing";
import { Client } from "@/models/client";
import { MarketingInfo } from "@/models/marketing-info";
import { MarketingPlan } from "@/models/marketing-plan";
import { MarketingReport } from "@/models/marketing-report";
import type { ActionState } from "@/types";

export async function saveInfoAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("marketing.manage");
  const parsed = infoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  await connectDb();
  const client = await Client.findOne({ code: parsed.data.clientCode }).select("name").lean();
  if (!client) return fail("Choose a client.");

  const existing = await MarketingInfo.findOne({ clientCode: parsed.data.clientCode });
  const social: Record<string, { username: string; password: string; pageLink: string }> = {};
  for (const key of SOCIALS) {
    const typed = String(formData.get(`social_${key}_password`) ?? "").trim();
    social[key] = {
      username: String(formData.get(`social_${key}_username`) ?? "").trim().slice(0, 200),
      pageLink: String(formData.get(`social_${key}_pageLink`) ?? "").trim().slice(0, 300),
      password: typed ? seal(typed) : existing?.social?.get(key)?.password ?? "",
    };
  }
  const data = { ...parsed.data, clientName: client.name, social };
  if (existing) {
    existing.set(data);
    await existing.save();
  } else {
    await MarketingInfo.create({ ...data, createdBy: user.username });
  }
  await writeAudit(user.username, existing ? "marketing.info.updated" : "marketing.info.created", { client: parsed.data.clientCode });
  revalidatePath("/marketing/info");
  redirect(user.role === "superadmin" ? "/marketing/info?own=1" : "/marketing/info");
}

export async function deleteInfoAction(clientCode: string): Promise<ActionState> {
  const user = await requireAction("marketing.manage");
  await connectDb();
  const result = await MarketingInfo.deleteOne({ clientCode });
  if (!result.deletedCount) return fail("Info document not found.");
  await writeAudit(user.username, "marketing.info.deleted", { client: clientCode });
  revalidatePath("/marketing/info");
  return done("Info document deleted.");
}

export async function savePlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("marketing.manage");
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  const client = await Client.findOne({ code: data.clientCode }).select("name").lean();
  if (!client) return fail("Choose a client.");

  const existing = id && isId(id) ? await MarketingPlan.findById(id) : null;
  if (id && !existing) return fail("Plan not found.");
  if (existing) {
    const oldPdf = existing.pdfUrl;
    existing.set({ ...data, clientName: client.name, pdfUrl: "" });
    await existing.save();
    if (oldPdf) await deleteFromR2(oldPdf);
  } else {
    await MarketingPlan.create({ ...data, clientName: client.name, createdBy: user.username });
  }
  await writeAudit(user.username, existing ? "marketing.plan.updated" : "marketing.plan.created", { client: data.clientCode });
  revalidatePath("/marketing/plans");
  redirect(user.role === "superadmin" ? "/marketing/plans?own=1" : "/marketing/plans");
}

export async function deletePlanAction(id: string): Promise<ActionState> {
  const user = await requireAction("marketing.manage");
  await connectDb();
  const plan = isId(id) ? await MarketingPlan.findByIdAndDelete(id).select("pdfUrl").lean() : null;
  if (!plan) return fail("Plan not found.");
  if (plan.pdfUrl) await deleteFromR2(plan.pdfUrl);
  await writeAudit(user.username, "marketing.plan.deleted", { id });
  revalidatePath("/marketing/plans");
  return done("Plan deleted.");
}

const MAX_IMAGES = 12;

export async function saveReportAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("marketing.manage");
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  const info = await MarketingInfo.findOne({ clientCode: data.clientCode }).select("clientName brandName").lean();
  if (!info) return { ok: false, message: "Choose a client from Client info.", errors: { clientCode: "Choose a client from Client info." } };
  const existing = id ? (isId(id) ? await MarketingReport.findOne({ _id: id }) : null) : null;
  if (id && !existing) return fail("Report not found.");

  const fresh: string[] = [];
  const removed: string[] = [];
  const platforms: Record<string, Record<string, unknown>> = {};
  for (const [platform] of REPORT_PLATFORMS) {
    const stats: Record<string, unknown> = {};
    for (const key of STAT_KEYS) stats[key] = String(formData.get(`${platform}_${key}`) ?? "").trim().slice(0, 2000);

    const before = (existing?.platforms?.[platform]?.analysisImages ?? []) as string[];
    const drop = new Set(formData.getAll(`${platform}_remove`).map(String));
    const kept = before.filter((url) => !drop.has(url));
    removed.push(...before.filter((url) => drop.has(url)));

    const files = formData.getAll(`${platform}_images`).filter((f): f is File => f instanceof File && f.size > 0);
    if (kept.length + files.length > MAX_IMAGES) return fail(`Keep ${platform} to ${MAX_IMAGES} images or fewer.`);
    const added: string[] = [];
    for (const file of files) {
      const upload = await uploadFile(file, "marketing", { images: true, maxMb: 5, what: "analysis image" });
      if (upload.error !== undefined) {
        await Promise.all([...fresh, ...added].map(deleteFromR2));
        return fail(upload.error);
      }
      added.push(upload.url);
    }
    fresh.push(...added);
    stats.analysisImages = [...kept, ...added];
    platforms[platform] = stats;
  }

  const hasData = Object.values(platforms).some((p) => Object.entries(p).some(([k, v]) => (k === "analysisImages" ? (v as string[]).length > 0 : Boolean(v))));
  if (!hasData) {
    await Promise.all(fresh.map(deleteFromR2));
    return fail("Record metrics or add images for at least one social platform.");
  }

  const nextActions = formData.getAll("nextActions").map((v) => String(v).trim().slice(0, 500)).filter(Boolean).slice(0, 20);
  const fields = { ...data, clientName: info.brandName || info.clientName, platforms, nextActions, pdfUrl: "" };
  const oldPdf = existing?.pdfUrl;
  if (existing) {
    existing.set(fields);
    await existing.save();
  } else {
    await MarketingReport.create({ ...fields, createdBy: user.username });
  }
  await Promise.all([...removed, ...(oldPdf ? [oldPdf] : [])].map(deleteFromR2));
  await writeAudit(user.username, existing ? "marketing.report.updated" : "marketing.report.created", { client: data.clientCode });
  revalidatePath("/marketing/reports");
  redirect(user.role === "superadmin" ? "/marketing/reports?own=1" : "/marketing/reports");
}

export async function deleteReportAction(id: string): Promise<ActionState> {
  const user = await requireAction("marketing.manage");
  await connectDb();
  const report = isId(id) ? await MarketingReport.findByIdAndDelete(id).select("platforms pdfUrl").lean() : null;
  if (!report) return fail("Report not found.");
  const urls = REPORT_PLATFORMS.flatMap(([p]) => (report.platforms?.[p]?.analysisImages ?? []) as string[]);
  await Promise.all([...urls, ...(report.pdfUrl ? [report.pdfUrl] : [])].map(deleteFromR2));
  await writeAudit(user.username, "marketing.report.deleted", { id });
  revalidatePath("/marketing/reports");
  return done("Report deleted.");
}
