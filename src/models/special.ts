import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const SPECIAL_TYPES = ["Influencer", "School", "Business", "Other"] as const;
export const SPECIAL_KINDS = ["quotation", "proposal", "srs"] as const;
export type SpecialKind = (typeof SPECIAL_KINDS)[number];

/** Clients the Super Admin handles directly (influencers, schools and the like). They never enter the sales, project or revenue flow. */
const clientSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: SPECIAL_TYPES, default: "Other" },
    contact: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    // The "Client info" tab: the same details as the marketing client info (brand, contacts, social accounts).
    infoSaved: { type: Boolean, default: false },
    info: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
clientSchema.index({ createdAt: -1 });
clientSchema.index({ infoSaved: 1, updatedAt: -1 });

const lineSchema = new mongoose.Schema({ name: { type: String, required: true }, price: { type: Number, required: true }, scope: { type: String, default: "" } }, { _id: false });

/** A quotation, a proposal or an SRS document for a special client. `body` holds the payment terms of a quotation, or the rich text of a proposal or SRS. */
const docSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: SPECIAL_KINDS, required: true },
    number: { type: String, required: true, unique: true },
    clientId: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    title: { type: String, default: "" },
    date: { type: String, required: true },
    valid: { type: String, default: "" },
    items: { type: [lineSchema], default: [] },
    discountPercent: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    body: { type: String, default: "" },
    // A proposal or SRS keeps its form fields here (the same fields the project reports use).
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
docSchema.index({ kind: 1, createdAt: -1 });

// A model that was loaded before these fields existed is replaced while developing.
if (process.env.NODE_ENV !== "production") {
  if (mongoose.models.SpecialClient && !mongoose.models.SpecialClient.schema.path("info")) mongoose.deleteModel("SpecialClient");
  if (mongoose.models.SpecialDoc && !mongoose.models.SpecialDoc.schema.path("data")) mongoose.deleteModel("SpecialDoc");
}

export type SpecialClientDoc = InferSchemaType<typeof clientSchema>;
export type SpecialDocDoc = InferSchemaType<typeof docSchema>;
export const SpecialClient: Model<SpecialClientDoc> = (mongoose.models.SpecialClient as Model<SpecialClientDoc>) || mongoose.model<SpecialClientDoc>("SpecialClient", clientSchema);
export const SpecialDoc: Model<SpecialDocDoc> = (mongoose.models.SpecialDoc as Model<SpecialDocDoc>) || mongoose.model<SpecialDocDoc>("SpecialDoc", docSchema);
