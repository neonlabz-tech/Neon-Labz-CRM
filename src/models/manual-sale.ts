import mongoose, { type InferSchemaType, type Model } from "mongoose";

/** Stored as the owner when a sale belongs to no salesperson. */
export { UNASSIGNED } from "./manual-sale-values";
export const MANUAL_SALE_STATUSES = ["pending", "confirmed", "rejected"] as const;
/** Who does the work once the sale is confirmed: the project managers, the marketing team, both, or the Super Admin personally. */
export const GOES_TO = ["project", "marketing", "both", "own"] as const;

const payment = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true },
    method: { type: String, default: "" },
    transactionId: { type: String, default: "" },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

/** A sale the Super Admin writes in by hand, outside the quotation and payment flow. */
const schema = new mongoose.Schema(
  {
    saleCode: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    business: { type: String, required: true, trim: true },
    service: { type: String, required: true, trim: true },
    owner: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    /** The sum of the payments below (older sales may carry an amount with no payment lines). */
    collected: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: MANUAL_SALE_STATUSES, default: "pending" },
    goesTo: { type: String, enum: GOES_TO, default: "project" },
    /** Added with "Add guest": an existing client, not a new sale. */
    guest: { type: Boolean, default: false },
    /** Set when the sale is confirmed and the client joins the paying clients. */
    clientCode: { type: String, default: "" },
    payments: { type: [payment], default: [] },
  },
  { timestamps: true }
);

export type ManualSaleDoc = InferSchemaType<typeof schema>;
// While developing, the dev server keeps the model from before an edit; drop it so a changed schema takes effect without a restart.
if (process.env.NODE_ENV !== "production" && mongoose.models.ManualSale) mongoose.deleteModel("ManualSale");
export const ManualSale: Model<ManualSaleDoc> = (mongoose.models.ManualSale as Model<ManualSaleDoc>) || mongoose.model<ManualSaleDoc>("ManualSale", schema);
