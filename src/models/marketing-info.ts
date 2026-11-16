import mongoose, { type InferSchemaType, type Model } from "mongoose";

const social = new mongoose.Schema({ username: { type: String, default: "" }, password: { type: String, default: "" }, pageLink: { type: String, default: "" } }, { _id: false });

const text = { type: String, default: "" };
const fields = {
  brandName: text, legalName: text, industry: text, tagline: text,
  mainContactName: text, mainContactTitle: text, assignedContactName: text, assignedContactTitle: text,
  email: text, phone: text, website: text, address: text, hours: text, preferredContact: text,
  primaryColor: text, secondaryColors: text, fonts: text,
};

const schema = new mongoose.Schema(
  {
    clientCode: { type: String, required: true, unique: true },
    clientName: { type: String, required: true },
    ...fields,
    /** Passwords here are encrypted before they are saved. */
    social: { type: Map, of: social, default: {} },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);
schema.index({ createdAt: -1 });

export type MarketingInfoDoc = InferSchemaType<typeof schema>;
export const MarketingInfo: Model<MarketingInfoDoc> = (mongoose.models.MarketingInfo as Model<MarketingInfoDoc>) || mongoose.model<MarketingInfoDoc>("MarketingInfo", schema);
