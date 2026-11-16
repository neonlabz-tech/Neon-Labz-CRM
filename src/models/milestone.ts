import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { DEPARTMENTS, MILESTONE_STATUS } from "@/lib/projects";

const schema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true },
    startDate: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    status: { type: String, enum: Object.keys(MILESTONE_STATUS), default: "pending" },
    department: { type: String, enum: DEPARTMENTS, default: "software" },
    assignees: { type: [String], default: [], index: true },
  },
  { timestamps: true }
);
schema.index({ projectId: 1, createdAt: 1 });

export type MilestoneDoc = InferSchemaType<typeof schema>;
export const Milestone: Model<MilestoneDoc> = (mongoose.models.Milestone as Model<MilestoneDoc>) || mongoose.model<MilestoneDoc>("Milestone", schema);
