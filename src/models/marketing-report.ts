import mongoose, { type InferSchemaType, type Model } from "mongoose";

const t = { type: String, default: "" };
const stats = new mongoose.Schema(
  {
    overview: t, totalViews: t, viewers: t, visits: t, interactions: t, videoViews: t, watchTime: t, newFollowers: t, conversations: t,
    nonFollowerPercent: t, followerPercent: t, audienceNote: t,
    contentIntro: t, reelsViews: t, photoViews: t, contentInteractions: t, photoInteractions: t, reelsInteractions: t, storiesInteractions: t, videoNote: t,
    /** Public Cloudflare R2 links of the uploaded screenshots. */
    analysisImages: { type: [String], default: [] },
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
    createdBy: { type: String, required: true },
    pdfUrl: t,
  },
  { timestamps: true }
);
schema.index({ createdAt: -1 });

export type MarketingReportDoc = InferSchemaType<typeof schema>;
export const MarketingReport: Model<MarketingReportDoc> = (mongoose.models.MarketingReport as Model<MarketingReportDoc>) || mongoose.model<MarketingReportDoc>("MarketingReport", schema);
