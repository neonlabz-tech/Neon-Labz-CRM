import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { POST_STATUS, POST_TYPES } from "@/lib/marketing";

const post = new mongoose.Schema(
  { date: String, time: String, topic: { type: String, default: "" }, type: { type: String, enum: POST_TYPES, default: "Poster" }, status: { type: String, enum: POST_STATUS, default: "Pending" } },
  { _id: false }
);
const ad = new mongoose.Schema(
  Object.fromEntries(["date", "time", "platforms", "adType", "objective", "target", "product", "offer", "duration", "message", "creative"].map((k) => [k, { type: String, default: "" }])),
  { _id: false }
);
const month = new mongoose.Schema({ label: String, startDate: { type: String, default: "" }, endDate: { type: String, default: "" }, theme: { type: String, default: "" }, posts: { type: [post], default: [] }, ad: { type: ad, default: () => ({}) } }, { _id: false });

const schema = new mongoose.Schema(
  {
    clientCode: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    address: { type: String, default: "" },
    cadence: { type: String, default: "" },
    months: { type: [month], default: [] },
    confirmNotes: { type: String, default: "" },
    createdBy: { type: String, required: true },
    pdfUrl: { type: String, default: "" },
  },
  { timestamps: true }
);
schema.index({ createdAt: -1 });

export type MarketingPlanDoc = InferSchemaType<typeof schema>;
export const MarketingPlan: Model<MarketingPlanDoc> = (mongoose.models.MarketingPlan as Model<MarketingPlanDoc>) || mongoose.model<MarketingPlanDoc>("MarketingPlan", schema);
