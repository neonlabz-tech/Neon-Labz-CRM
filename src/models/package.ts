import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const CATEGORIES = ["Software development", "Marketing", "Both"] as const;
export const DURATIONS = ["Per project", "Per month", "3 months"] as const;

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    duration: { type: String, enum: DURATIONS, default: "Per project" },
    features: { type: [String], default: [] },
    cover: { type: String, default: "" },
    icon: { type: String, default: "" },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true }
);
schema.index({ status: 1, category: 1, createdAt: -1 });
schema.index({ name: 1 });

export type PackageDoc = InferSchemaType<typeof schema>;
export const Package: Model<PackageDoc> = (mongoose.models.Package as Model<PackageDoc>) || mongoose.model<PackageDoc>("Package", schema);
