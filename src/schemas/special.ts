import { z } from "zod";
import { ISO_DATE } from "@/lib/dates";
import { EMAIL_ERROR, PHONE_ERROR, formatPhone, validEmail, validSriLankanPhone } from "@/lib/phone";
import { SPECIAL_TYPES } from "@/models/special";
import { proposalSchema, srsSchema } from "@/schemas/report";

const email = z.string().trim().max(160).refine((v) => !v || validEmail(v), EMAIL_ERROR);
const phone = z.string().trim().max(20).refine((v) => !v || validSriLankanPhone(v), PHONE_ERROR).transform((v) => (v ? formatPhone(v) : ""));

export const specialClientSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter the client name.").max(120),
  type: z.enum(SPECIAL_TYPES, { message: "Choose a type." }),
  contact: z.string().trim().max(120).default(""),
  phone,
  email,
  address: z.string().trim().max(300).default(""),
});

const day = z.string().regex(ISO_DATE, "Choose a date.");

const lineSchema = z.object({
  name: z.string().trim().min(1, "Give every item a name."),
  price: z.coerce.number({ message: "Each item needs a price." }).positive("Each item price must be more than zero."),
  scope: z.string().trim().default(""),
});

export const specialQuoteSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Choose a client."),
  date: day,
  valid: z.union([z.literal(""), z.string().regex(ISO_DATE)]).default(""),
  discount: z.coerce.number().min(0, "Offer must be a percentage from 0 to 100.").max(100, "Offer must be a percentage from 0 to 100.").default(0),
  terms: z.string().trim().max(20000).default(""),
  lines: z.string().transform((raw, ctx) => {
    try {
      const parsed = z.array(lineSchema).min(1, "Add at least one item.").max(30).safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Check the items." });
    } catch {
      ctx.addIssue({ code: "custom", message: "Add at least one item." });
    }
    return z.NEVER;
  }),
});

/** The proposal and SRS forms are the ones the project reports use, with a client in place of the project. */
export const specialProposalSchema = proposalSchema.omit({ projectCode: true }).extend({ clientId: z.string().min(1, "Choose a client.") });
export const specialSrsSchema = srsSchema.omit({ projectCode: true }).extend({ clientId: z.string().min(1, "Choose a client.") });
