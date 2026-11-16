import { z } from "zod";
import { ISO_DATE } from "@/lib/dates";
import { GOES_TO, MANUAL_SALE_STATUSES, UNASSIGNED } from "@/models/manual-sale";

const money = (message: string) => z.coerce.number({ error: message }).min(0, message).max(1_000_000_000, message);

export const manualSaleSchema = z
  .object({
    id: z.string().optional(),
    business: z.string().trim().min(1, "Client is required.").max(160),
    date: z.string().regex(ISO_DATE, "Sale date is required."),
    service: z.string().trim().min(1, "Service or package is required.").max(160),
    owner: z.string().trim().min(1, "Choose a salesperson."),
    amount: money("Sale value must be zero or more."),
    collected: money("Collected amount must be zero or more.").default(0),
    status: z.enum(MANUAL_SALE_STATUSES, "Choose a status."),
    goesTo: z.enum(GOES_TO, "Choose who handles this sale."),
  })
  .refine((v) => v.collected <= v.amount, { path: ["collected"], message: "Collection cannot exceed the sale value." })
  .refine((v) => v.goesTo !== "own" || v.owner === UNASSIGNED, { path: ["goesTo"], message: "Only an unassigned sale can be handled by the Super Admin." });

export const salePaymentSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number({ error: "Enter the amount received." }).positive("The amount must be more than zero."),
  date: z.string().regex(ISO_DATE, "Payment date is required."),
  method: z.string({ message: "Enter the payment method." }).trim().min(1, "Enter the payment method.").max(60),
  transactionId: z.string({ message: "Enter the transaction or reference no." }).trim().min(1, "Enter the transaction or reference no.").max(80),
});
