import { z } from "zod";
import { EMAIL_ERROR, PHONE_ERROR, formatPhone, validEmail, validSriLankanPhone } from "@/lib/phone";

const email = z.string().trim().max(160).refine((v) => !v || validEmail(v), EMAIL_ERROR);
const phone = z.string().trim().max(20).refine((v) => !v || validSriLankanPhone(v), PHONE_ERROR).transform((v) => (v ? formatPhone(v) : ""));

const person = z.object({ name: z.string().trim().max(120), title: z.string().trim().max(120), email, phone })
  .refine((p) => !(p.title || p.email || p.phone) || p.name, { path: ["name"], message: "Each sub contact needs a name." });

export const clientContactsSchema = z.object({
  code: z.string().min(1),
  name: z.string().trim().min(1, "Client name is required.").max(120),
  service: z.string().trim().max(200).default(""),
  workType: z.enum(["software", "marketing", "both"]).optional(),
  contactName: z.string().trim().min(1, "Client main person name is required.").max(120),
  contactTitle: z.string().trim().max(120).default(""),
  assignedPerson: z.string().trim().max(120).default(""),
  email,
  phone,
  address: z.string().trim().max(300).default(""),
  notes: z.string().trim().max(2000).default(""),
  subContacts: z.string().default("[]").transform((raw, ctx) => {
    try {
      const parsed = z.array(person).max(20).safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data.filter((p) => p.name || p.title || p.email || p.phone);
      ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Check the sub contacts." });
    } catch {
      ctx.addIssue({ code: "custom", message: "Check the sub contacts." });
    }
    return z.NEVER;
  }),
});
