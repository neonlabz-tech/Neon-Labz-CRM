import { z } from "zod";
import { PAYMENT_TYPES } from "@/models/payment";
import { ISO_DATE } from "@/lib/dates";

export const paymentSchema = z.object({
  leadId: z.string().min(1, "Choose a converted client with a saved quotation."),
  amount: z.coerce.number({ message: "Enter the amount received." }).positive("Received amount must be greater than zero."),
  date: z.string().regex(ISO_DATE, "Payment date is required."),
  type: z.enum(PAYMENT_TYPES, { message: "Choose a payment type." }),
  method: z.string({ message: "Enter the payment method." }).trim().min(1, "Enter the payment method.").max(60),
  transactionId: z.string().trim().max(80).default(""),
});
