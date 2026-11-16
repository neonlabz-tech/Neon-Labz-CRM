import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { ROLES } from "@/lib/permissions";

const schema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, uppercase: true, trim: true },
    role: { type: String, enum: ROLES, required: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    /** The current password, encrypted, so the Super Admin can view it after confirming their own password. */
    passwordVault: { type: String, select: false, default: "" },
    mustChangePassword: { type: Boolean, default: true },
    passwordUpdatedAt: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },
    fullName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);
schema.index({ createdAt: -1 });
schema.index({ role: 1, email: 1 });

export type UserDoc = InferSchemaType<typeof schema>;
export const User: Model<UserDoc> = (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", schema);
