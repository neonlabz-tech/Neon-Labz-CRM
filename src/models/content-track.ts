import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { APPROVAL_STATUS, PUBLISH_STATUS } from "@/lib/content-tracker";

/**
 * What the Marketing team fills in for one planned post. The date, time, topic and type come from the content plan itself;
 * a row here is found by the plan, the month and the position of the post in that month (`slot`, for example "0-2").
 */
const schema = new mongoose.Schema(
  {
    projectCode: { type: String, required: true, index: true },
    planId: { type: String, required: true },
    slot: { type: String, required: true },
    contentId: { type: String, required: true },
    contentType: { type: String, default: "" },
    assignee: { type: String, default: "" },
    caption: { type: String, default: "" },
    approval: { type: String, enum: APPROVAL_STATUS, default: "Pending" },
    scheduleDate: { type: String, default: "" },
    publishStatus: { type: String, enum: PUBLISH_STATUS, default: "Pending" },
  },
  { timestamps: true }
);
schema.index({ projectCode: 1, planId: 1, slot: 1 }, { unique: true });

export type ContentItemDoc = InferSchemaType<typeof schema>;
export const ContentItem: Model<ContentItemDoc> = (mongoose.models.ContentItem as Model<ContentItemDoc>) || mongoose.model<ContentItemDoc>("ContentItem", schema);

/** The Content Type choices. Shared by every project. */
const option = new mongoose.Schema({ name: { type: String, required: true, trim: true } }, { timestamps: true });
option.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
export const ContentTypeOption: Model<{ name: string }> = (mongoose.models.ContentTypeOption as Model<{ name: string }>) || mongoose.model<{ name: string }>("ContentTypeOption", option);
