"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { done, fail, invalid } from "@/lib/form";
import { REPORT_PLATFORMS, SOCIALS, platformHasData, type PlatformData } from "@/lib/marketing";
import { deleteFromR2 } from "@/lib/r2";
import { uploadFile } from "@/lib/uploads";
import { isId } from "@/lib/project-access";
import { seal } from "@/lib/secrets";
import { infoSchema, planSchema, platformInputSchema, reportSchema } from "@/schemas/marketing";
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
  const client = await Client.findOne({ code: parsed.data.clientCode }).select("name logo").lean();
  if (!client) return fail("Choose a client.");
  // The logo is optional and belongs to the client, so it shows everywhere the client's logo does. A new file replaces it; the box removes it.
  const upload = await uploadFile(formData.get("logo"), "logos", { images: true, maxMb: 2, what: "logo" });
  if (upload.error) return { ok: false, message: upload.error, errors: { logo: upload.error } };
  const logoChange = upload.url ? { logo: upload.url } : formData.get("removeLogo") === "on" ? { logo: "" } : null;

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
  if (logoChange) {
    await Client.updateOne({ code: parsed.data.clientCode }, logoChange);
    if (client.logo) await deleteFromR2(client.logo);
    revalidatePath("/clients");
  }
  await writeAudit(user.username, existing ? "marketing.info.updated" : "marketing.info.created", { client: parsed.data.clientCode });
  revalidatePath("/marketing/info");
  redirect("/marketing/info");
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
  redirect("/marketing/plans");
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

/** Reads one platform of the report form. Screenshots that are already saved are kept only if they really belong to this report. */
async function readPlatform(platform: string, formData: FormData, before: string[], fresh: string[]): Promise<{ data: PlatformData; kept: string[] } | { error: string }> {
  let json: unknown = {};
  try {
    json = JSON.parse(String(formData.get(`${platform}_data`) ?? "{}"));
  } catch {
    return { error: "A platform's details could not be read. Please try again." };
  }
  const parsed = platformInputSchema.safeParse(json);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the platform details." };
  const input = parsed.data;

  const saved = new Set(before);
  const shots: { url: string; caption: string }[] = [];
  for (const shot of input.shots) {
    if (shot.url) {
      if (saved.has(shot.url)) shots.push({ url: shot.url, caption: shot.caption });
      continue;
    }
    const file = formData.get(`${platform}_file_${shot.key}`);
    if (!(file instanceof File) || file.size === 0) continue;
    const upload = await uploadFile(file, "marketing", { images: true, maxMb: 5, what: "analysis image" });
    if (upload.error !== undefined) return { error: upload.error };
    fresh.push(upload.url);
    shots.push({ url: upload.url, caption: shot.caption });
  }
  if (shots.length > MAX_IMAGES) return { error: `Keep ${platform} to ${MAX_IMAGES} images or fewer.` };

  return {
    data: {
      intro: input.intro,
      analysis: input.analysis,
      metrics: input.metrics.filter((m) => m.label && m.value),
      posts: input.posts.filter((p) => p.title),
      audience: input.audience.filter((a) => a.label && a.value),
      shots,
    },
    kept: shots.map((s) => s.url),
  };
}

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
  const platforms: Record<string, PlatformData> = {};
  for (const [platform] of REPORT_PLATFORMS) {
    const before = (existing?.platforms?.[platform]?.shots ?? []).map((s) => s.url).filter(Boolean) as string[];
    const result = await readPlatform(platform, formData, before, fresh);
    if ("error" in result) {
      await Promise.all(fresh.map(deleteFromR2));
      return fail(result.error);
    }
    removed.push(...before.filter((url) => !result.kept.includes(url)));
    platforms[platform] = result.data;
  }

  // Meta ads screenshots are read the same way as a platform's: kept ones stay, new files are uploaded.
  const metaBefore = (existing?.metaShots ?? []).map((s) => s.url).filter(Boolean) as string[];
  const metaResult = await readPlatform("meta", formData, metaBefore, fresh);
  if ("error" in metaResult) {
    await Promise.all(fresh.map(deleteFromR2));
    return fail(metaResult.error);
  }
  removed.push(...metaBefore.filter((url) => !metaResult.kept.includes(url)));

  if (!Object.values(platforms).some((p) => platformHasData(p))) {
    await Promise.all(fresh.map(deleteFromR2));
    return fail("Add numbers, notes or screenshots for at least one social platform.");
  }

  const nextActions = formData.getAll("nextActions").map((v) => String(v).trim().slice(0, 500)).filter(Boolean).slice(0, 20);
  const fields = { ...data, clientName: info.brandName || info.clientName, platforms, metaShots: metaResult.data.shots, nextActions, pdfUrl: "" };
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
  redirect("/marketing/reports");
}

export async function deleteReportAction(id: string): Promise<ActionState> {
  const user = await requireAction("marketing.manage");
  await connectDb();
  const report = isId(id) ? await MarketingReport.findByIdAndDelete(id).select("platforms metaShots pdfUrl").lean() : null;
  if (!report) return fail("Report not found.");
  const urls = [
    ...REPORT_PLATFORMS.flatMap(([p]) => (report.platforms?.[p]?.shots ?? []).map((s) => s.url).filter(Boolean) as string[]),
    ...((report.metaShots ?? []).map((s) => s.url).filter(Boolean) as string[]),
  ];
  await Promise.all([...urls, ...(report.pdfUrl ? [report.pdfUrl] : [])].map(deleteFromR2));
  await writeAudit(user.username, "marketing.report.deleted", { id });
  revalidatePath("/marketing/reports");
  return done("Report deleted.");
}
