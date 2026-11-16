import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { DEPARTMENTS, PRIORITY, TASK_STATUS } from "@/lib/projects";

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    milestoneId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    department: { type: String, enum: DEPARTMENTS, default: "software" },
    priority: { type: String, enum: Object.keys(PRIORITY), default: "medium" },
    assigneeCode: { type: String, default: "", index: true },
    createdBy: { type: String, default: "" },
    startDate: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    description: { type: String, default: "" },
    status: { type: String, enum: Object.keys(TASK_STATUS), default: "not-started", index: true },
    completedAt: { type: Date, default: null },
    doneAt: { type: Date, default: null },
  },
  { timestamps: true }
);
schema.index({ assigneeCode: 1, status: 1 });
schema.index({ projectId: 1, milestoneId: 1, createdAt: -1 });

export type TaskDoc = InferSchemaType<typeof schema>;
export const Task: Model<TaskDoc> = (mongoose.models.Task as Model<TaskDoc>) || mongoose.model<TaskDoc>("Task", schema);
