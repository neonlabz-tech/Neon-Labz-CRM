import mongoose, { type InferSchemaType, type Model } from "mongoose";

const schema = new mongoose.Schema(
  {
    actor: { type: String, required: true },
    action: { type: String, required: true },
    detail: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ createdAt: -1 });
schema.index({ actor: 1, createdAt: -1 });
schema.index({ action: 1, createdAt: -1 });

export type AuditDoc = InferSchemaType<typeof schema>;
export const Audit: Model<AuditDoc> = (mongoose.models.Audit as Model<AuditDoc>) || mongoose.model<AuditDoc>("Audit", schema);
