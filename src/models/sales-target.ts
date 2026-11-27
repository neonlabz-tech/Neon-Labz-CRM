import mongoose, { type InferSchemaType, type Model } from "mongoose";

const target = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, trim: true, default: "" },
    target: { type: Number, min: 0, default: 0 },
    rate: { type: Number, min: 0, max: 100, default: 0 },
    dailyLeads: { type: Number, min: 0, default: 0 },
    dailyCalls: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

/** One document holding the company defaults every salesperson falls back to. */
const setting = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "sales" },
    monthlyTarget: { type: Number, min: 0, default: 0 },
    /** Clients a salesperson is expected to convert in a month; the Productivity ranking measures Sales against it. */
    monthlyConversions: { type: Number, min: 0, default: 0 },
    dailyLeads: { type: Number, min: 0, default: 0 },
    dailyCalls: { type: Number, min: 0, default: 0 },
    defaultRate: { type: Number, min: 0, max: 100, default: 0 },
  },
  { timestamps: true }
);

export type SalesTargetDoc = InferSchemaType<typeof target>;
export type SalesSettingDoc = InferSchemaType<typeof setting>;
export const SalesTarget: Model<SalesTargetDoc> = (mongoose.models.SalesTarget as Model<SalesTargetDoc>) || mongoose.model<SalesTargetDoc>("SalesTarget", target);
// A model registered before "monthlyConversions" existed would drop it when saving, so it is registered again.
if (mongoose.models.SalesSetting && !mongoose.models.SalesSetting.schema.path("monthlyConversions")) mongoose.deleteModel("SalesSetting");
export const SalesSetting: Model<SalesSettingDoc> = (mongoose.models.SalesSetting as Model<SalesSettingDoc>) || mongoose.model<SalesSettingDoc>("SalesSetting", setting);
