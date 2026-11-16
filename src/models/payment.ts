import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const PAYMENT_TYPES = ["First installment", "Second installment", "Full payment", "Other installment"] as const;

const schema = new mongoose.Schema(
  {
    saleCode: { type: String, required: true, unique: true },
    owner: { type: String, required: true, index: true },
    quoteId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    leadId: { type: String, required: true },
    clientCode: { type: String, required: true },
    clientName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: String, required: true },
    type: { type: String, enum: PAYMENT_TYPES, required: true },
    method: { type: String, default: "" },
    transactionId: { type: String, default: "" },
    proofUrl: { type: String, default: "" },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending", index: true },
    approval: { type: String, enum: ["pending", "approved"], default: "pending" },
  },
  { timestamps: true }
);
schema.index({ owner: 1, createdAt: -1 });
schema.index({ createdAt: -1 });

export type PaymentDoc = InferSchemaType<typeof schema>;
export const Payment: Model<PaymentDoc> = (mongoose.models.Payment as Model<PaymentDoc>) || mongoose.model<PaymentDoc>("Payment", schema);
