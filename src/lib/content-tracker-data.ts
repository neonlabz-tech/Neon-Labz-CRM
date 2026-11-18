import "server-only";
import { connectDb } from "./db";
import { nextSeq } from "./counters";
import { DEFAULT_CONTENT_TYPES } from "./content-tracker";
import { ContentItem, ContentTypeOption } from "@/models/content-track";
import { MarketingPlan } from "@/models/marketing-plan";

export type TrackRow = {
  key: string; planId: string; slot: string; contentId: string;
  publishDate: string; time: string; topic: string; postType: string;
  contentType: string; assignee: string; caption: string; approval: string; scheduleDate: string; publishStatus: string;
};

/** The Content Type choices, adding the starter list the first time. */
export async function contentTypeNames(): Promise<string[]> {
  await connectDb();
  if ((await ContentTypeOption.estimatedDocumentCount()) === 0) {
    await ContentTypeOption.insertMany(DEFAULT_CONTENT_TYPES.map((name) => ({ name })), { ordered: false }).catch(() => undefined);
  }
  const rows = await ContentTypeOption.find().select("name").sort({ createdAt: 1, name: 1 }).lean();
  return rows.map((r) => r.name);
}

/** The Content Type choices with their ids and how many rows use each, for the manage panel. */
export async function contentTypeList(): Promise<{ id: string; name: string; count: number }[]> {
  await contentTypeNames();
  const [rows, usage] = await Promise.all([
    ContentTypeOption.find().select("name").sort({ createdAt: 1, name: 1 }).lean(),
    ContentItem.aggregate<{ _id: string; n: number }>([{ $match: { contentType: { $ne: "" } } }, { $group: { _id: "$contentType", n: { $sum: 1 } } }]),
  ]);
  return rows.map((r) => ({ id: String(r._id), name: r.name, count: usage.find((u) => u._id === r.name)?.n ?? 0 }));
}

/**
 * Every post in the client's content plans, joined with what Marketing has filled in. A post that has no row yet gets one here,
 * with the next Content ID for the project (for example NPRJ001-C001). Date, time, topic and type are always read fresh from the plan.
 */
export async function loadTracker(projectCode: string, clientCode: string): Promise<TrackRow[]> {
  await connectDb();
  const plans = await MarketingPlan.find({ clientCode }).select("title months").sort({ createdAt: 1 }).lean();
  const planIds = plans.map((p) => String(p._id));
  let items = await ContentItem.find({ projectCode, planId: { $in: planIds } }).lean();
  const have = new Set(items.map((i) => `${i.planId}|${i.slot}`));

  let created = false;
  for (const plan of plans) {
    for (const [mi, month] of plan.months.entries()) {
      for (const pi of month.posts.keys()) {
        const slot = `${mi}-${pi}`;
        if (have.has(`${plan._id}|${slot}`)) continue;
        const contentId = `${projectCode}-C${String(await nextSeq(`content:${projectCode}`)).padStart(3, "0")}`;
        // Two people opening the page at once can race; the unique index keeps one row and the other insert is ignored.
        await ContentItem.create({ projectCode, planId: String(plan._id), slot, contentId }).catch(() => undefined);
        created = true;
      }
    }
  }
  if (created) items = await ContentItem.find({ projectCode, planId: { $in: planIds } }).lean();
  const byKey = new Map(items.map((i) => [`${i.planId}|${i.slot}`, i]));

  const rows: TrackRow[] = [];
  for (const plan of plans) {
    for (const [mi, month] of plan.months.entries()) {
      for (const [pi, post] of month.posts.entries()) {
        const slot = `${mi}-${pi}`;
        const item = byKey.get(`${plan._id}|${slot}`);
        if (!item) continue;
        rows.push({
          key: `${plan._id}|${slot}`, planId: String(plan._id), slot, contentId: item.contentId,
          publishDate: post.date ?? "", time: post.time ?? "", topic: post.topic ?? "", postType: post.type ?? "",
          contentType: item.contentType ?? "", assignee: item.assignee ?? "", caption: item.caption ?? "",
          approval: item.approval ?? "Pending", scheduleDate: item.scheduleDate ?? "", publishStatus: item.publishStatus ?? "Pending",
        });
      }
    }
  }
  return rows.sort((a, b) => (a.publishDate || "9999").localeCompare(b.publishDate || "9999") || a.time.localeCompare(b.time) || a.contentId.localeCompare(b.contentId));
}
