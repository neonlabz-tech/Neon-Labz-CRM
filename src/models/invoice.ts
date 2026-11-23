import mongoose, { type InferSchemaType, type Model } from "mongoose";

const schema = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true, unique: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    quoteId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    quoteNumber: { type: String, required: true },
    quoteTotal: { type: Number, required: true },
    salesOwner: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    clientCode: { type: String, required: true },
    contact: { type: String, default: "" },
    projectDetail: { type: String, default: "" },
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    method: { type: String, default: "" },
    transactionId: { type: String, default: "" },
    date: { type: String, required: true },
    approval: { type: String, enum: ["pending", "approved"], default: "pending", index: true },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    pdfUrl: { type: String, default: "" },
    pdfVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);
schema.index({ approval: 1, createdAt: -1 });

export type InvoiceDoc = InferSchemaType<typeof schema>;
export const Invoice: Model<InvoiceDoc> = (mongoose.models.Invoice as Model<InvoiceDoc>) || mongoose.model<InvoiceDoc>("Invoice", schema);
