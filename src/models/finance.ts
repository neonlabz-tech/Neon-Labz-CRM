import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { PAY_STATUSES } from "@/lib/finance";

const payroll = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    date: { type: String, required: true, index: true },
    base: { type: Number, required: true, min: 0 },
    commission: { type: Number, required: true, min: 0 },
    status: { type: String, enum: PAY_STATUSES, default: "Non-paid", index: true },
  },
  { timestamps: true }
);
payroll.index({ employee: 1, month: 1 }, { unique: true });

const expense = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    description: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0.01 },
  },
  { timestamps: true }
);

const category = new mongoose.Schema({ name: { type: String, required: true, trim: true } }, { timestamps: true });
category.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

const revenue = new mongoose.Schema(
  {
    /** The sales login the money is credited to; blank for other revenue. */
    salesPerson: { type: String, default: "" },
    date: { type: String, required: true, index: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
  },
  { timestamps: true }
);

export type PayrollDoc = InferSchemaType<typeof payroll>;
export type ExpenseDoc = InferSchemaType<typeof expense>;
export type CategoryDoc = InferSchemaType<typeof category>;
export type RevenueDoc = InferSchemaType<typeof revenue>;
export const Payroll: Model<PayrollDoc> = (mongoose.models.Payroll as Model<PayrollDoc>) || mongoose.model<PayrollDoc>("Payroll", payroll);
export const Expense: Model<ExpenseDoc> = (mongoose.models.Expense as Model<ExpenseDoc>) || mongoose.model<ExpenseDoc>("Expense", expense);
export const ExpenseCategory: Model<CategoryDoc> = (mongoose.models.ExpenseCategory as Model<CategoryDoc>) || mongoose.model<CategoryDoc>("ExpenseCategory", category);
export const Revenue: Model<RevenueDoc> = (mongoose.models.Revenue as Model<RevenueDoc>) || mongoose.model<RevenueDoc>("Revenue", revenue);
