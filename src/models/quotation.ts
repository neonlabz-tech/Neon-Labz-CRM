import mongoose, { type InferSchemaType, type Model } from "mongoose";

const item = new mongoose.Schema(
  { packageId: String, packageName: { type: String, required: true }, service: String, period: String, price: { type: Number, required: true }, scope: { type: String, required: true } },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    owner: { type: String, required: true, index: true },
    leadId: { type: String, required: true, unique: true },
    clientCode: { type: String, default: "" },
    client: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    items: { type: [item], default: [] },
    subtotal: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    terms: { type: String, required: true },
    date: { type: String, required: true },
    valid: { type: String, default: "" },
    pdfUrl: { type: String, default: "" },
  },
  { timestamps: true }
);
schema.index({ createdAt: -1 });
schema.index({ owner: 1, createdAt: -1 });

export type QuotationDoc = InferSchemaType<typeof schema>;
export const Quotation: Model<QuotationDoc> = (mongoose.models.Quotation as Model<QuotationDoc>) || mongoose.model<QuotationDoc>("Quotation", schema);
