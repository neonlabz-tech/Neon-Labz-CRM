import { z } from "zod";
import { ISO_DATE } from "@/lib/dates";

const quoteLineSchema = z.object({
  packageId: z.string().min(1, "Choose a package on every line."),
  customName: z.string().trim().default(""),
  price: z.coerce.number({ message: "Each package needs a price." }).positive("Each package price must be greater than zero."),
  scope: z.string().trim().min(1, "Each package needs a scope."),
  icon: z.string().default(""),
});

export const quotationSchema = z.object({
  leadId: z.string().min(1),
  date: z.string().regex(ISO_DATE, "Quotation date is required."),
  valid: z.union([z.literal(""), z.string().regex(ISO_DATE)]).default(""),
  discount: z.coerce.number().min(0, "Offer must be a percentage from 0 to 100.").max(100, "Offer must be a percentage from 0 to 100.").default(0),
  terms: z.string().trim().default(""),
  lines: z.string().transform((raw, ctx) => {
    try {
      const parsed = z.array(quoteLineSchema).min(1, "Add at least one package.").safeParse(JSON.parse(raw));
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Check the packages." });
        return z.NEVER;
      }
      return parsed.data;
    } catch {
      ctx.addIssue({ code: "custom", message: "Add at least one package." });
      return z.NEVER;
    }
  }),
});
