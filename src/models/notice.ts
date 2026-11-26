import mongoose, { type InferSchemaType, type Model } from "mongoose";

const schema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    text: { type: String, required: true },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
    /** For a notification that points at a project: false until the person opens that project (the count on its My work card). */
    projectSeen: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ to: 1, read: 1, createdAt: -1 });

export type NoticeDoc = InferSchemaType<typeof schema>;
// A model registered before "projectSeen" existed would drop it when saving, so it is registered again.
if (mongoose.models.Notice && !mongoose.models.Notice.schema.path("projectSeen")) mongoose.deleteModel("Notice");
export const Notice: Model<NoticeDoc> = (mongoose.models.Notice as Model<NoticeDoc>) || mongoose.model<NoticeDoc>("Notice", schema);
