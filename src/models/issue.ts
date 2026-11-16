import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ISSUE_TYPES } from "@/lib/issues";

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    projectCode: { type: String, required: true, index: true },
    status: { type: String, enum: Object.keys(ISSUE_STATUSES), default: "open", index: true },
    priority: { type: String, enum: Object.keys(ISSUE_PRIORITIES), default: "medium" },
    type: { type: String, enum: Object.keys(ISSUE_TYPES), default: "bug" },
    assignee: { type: String, default: "", index: true },
    dueDate: { type: String, default: "" },
    reportedAt: { type: String, required: true },
    description: { type: String, default: "" },
    steps: { type: String, default: "" },
    expected: { type: String, default: "" },
    createdBy: { type: String, required: true, index: true },
  },
  { timestamps: true }
);
schema.index({ createdBy: 1, createdAt: -1 });

export type IssueDoc = InferSchemaType<typeof schema>;
export const Issue: Model<IssueDoc> = (mongoose.models.Issue as Model<IssueDoc>) || mongoose.model<IssueDoc>("Issue", schema);
