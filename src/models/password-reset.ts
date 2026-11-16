import mongoose, { type InferSchemaType, type Model } from "mongoose";

const schema = new mongoose.Schema(
  {
    username: { type: String, required: true, uppercase: true, trim: true, index: true },
    tokenHash: { type: String, default: "", index: true },
    purpose: { type: String, enum: ["superadmin-link", "staff-request"], required: true },
    status: { type: String, enum: ["open", "completed"], default: "open", index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
schema.index({ createdAt: -1 });

export type PasswordResetDoc = InferSchemaType<typeof schema>;
export const PasswordReset: Model<PasswordResetDoc> =
  (mongoose.models.PasswordReset as Model<PasswordResetDoc>) || mongoose.model<PasswordResetDoc>("PasswordReset", schema);
