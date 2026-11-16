import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { PROJECT_STATUS, PROJECT_TYPES } from "@/lib/projects";

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    owner: { type: String, required: true, index: true },
    clientCode: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    type: { type: String, enum: PROJECT_TYPES, default: "software" },
    status: { type: String, enum: Object.keys(PROJECT_STATUS), default: "in-progress" },
    softwareStatus: { type: String, enum: ["in-progress", "completed"], default: "in-progress" },
    marketingStatus: { type: String, enum: ["in-progress", "completed"], default: "in-progress" },
    startDate: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    description: { type: String, default: "" },
    service: { type: String, default: "" },
    archived: { type: Boolean, default: false },
    assignees: { type: [String], default: [], index: true },
    marketingAssignees: { type: [String], default: [], index: true },
  },
  { timestamps: true }
);
schema.index({ archived: 1, type: 1, createdAt: -1 });

export type ProjectDoc = InferSchemaType<typeof schema>;
export const Project: Model<ProjectDoc> = (mongoose.models.Project as Model<ProjectDoc>) || mongoose.model<ProjectDoc>("Project", schema);
