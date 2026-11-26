import mongoose, { type InferSchemaType, type Model } from "mongoose";

const t = { type: String, default: "" };
const row = new mongoose.Schema({ label: t, value: t }, { _id: false });
const post = new mongoose.Schema({ title: t, views: t }, { _id: false });
/** A screenshot kept in Cloudflare R2, with an optional caption. */
const shot = new mongoose.Schema({ url: t, caption: t }, { _id: false });
const stats = new mongoose.Schema(
  {
    intro: t,
    metrics: { type: [row], default: [] },
    analysis: t,
    posts: { type: [post], default: [] },
    audience: { type: [row], default: [] },
    shots: { type: [shot], default: [] },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    clientCode: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    title: { type: String, default: "", trim: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    platforms: {
      type: new mongoose.Schema(
        { facebook: { type: stats, default: () => ({}) }, instagram: { type: stats, default: () => ({}) }, tiktok: { type: stats, default: () => ({}) }, youtube: { type: stats, default: () => ({}) }, linkedin: { type: stats, default: () => ({}) } },
        { _id: false }
      ),
      default: () => ({}),
    },
    nextActions: { type: [String], default: [] },
    contentDirection: t,
    clientSummary: { type: String, required: true },
    /** "Meta ads performance & summary": one line, then screenshots of the Meta ads results. */
    metaSummary: t,
    metaShots: { type: [shot], default: [] },
    createdBy: { type: String, required: true },
    pdfUrl: t,
  },
  { timestamps: true }
);
schema.index({ createdAt: -1 });

export type MarketingReportDoc = InferSchemaType<typeof schema>;
export const MarketingReport: Model<MarketingReportDoc> = (mongoose.models.MarketingReport as Model<MarketingReportDoc>) || mongoose.model<MarketingReportDoc>("MarketingReport", schema);
