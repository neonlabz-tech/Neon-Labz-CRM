import { z } from "zod";
import { ISO_DATE } from "@/lib/dates";
import { PAY_STATUSES } from "@/lib/finance";

const dayOf = (message: string) => z.string().min(1, message).regex(ISO_DATE, message);
const money = (label: string) => z.coerce.number({ error: `Enter the ${label}.` }).min(0, "The amount cannot be negative.").max(1_000_000_000);
const positive = z.coerce.number({ error: "Enter an amount greater than zero." }).gt(0, "Enter an amount greater than zero.").max(1_000_000_000);

export const payrollSchema = z.object({
  id: z.string().optional(),
  employee: z.string().min(1, "Choose an employee."),
  base: money("base amount"),
  commission: money("commission"),
  commissionMonth: z.string().regex(/^(\d{4}-\d{2})?$/, "Choose the commission month.").default(""),
  date: dayOf("Pay date is required."),
  status: z.enum(PAY_STATUSES, "Choose a status."),
});

export const expenseSchema = z.object({
  id: z.string().optional(),
  date: dayOf("Select a date."),
  category: z.string().trim().min(1, "Choose a category."),
  description: z.string().trim().max(500).default(""),
  amount: positive,
});

export const categorySchema = z.object({ name: z.string().trim().min(1, "Enter a category name.").max(80) });

export const revenueSchema = z.object({
  id: z.string().optional(),
  salesPerson: z.string().trim().default(""),
  date: dayOf("Collection date is required."),
  description: z.string().trim().min(1, "Describe this revenue.").max(500),
  amount: positive,
});
