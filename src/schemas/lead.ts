import { z } from "zod";
import { CALL_OUTCOMES, LEAD_SERVICES, LEAD_SOURCES, LEAD_STAGES } from "@/models/lead";
import { ISO_DATE } from "@/lib/dates";

const day = z.string().regex(ISO_DATE, "Choose a date.");
const optionalDay = z.union([z.literal(""), day]).default("");

export const leadSchema = z.object({
  id: z.string().optional(),
  date: day.optional(),
  business: z.string().trim().min(1, "Business or customer name is required.").max(160),
  phone: z.string().trim().min(1, "Phone is required."),
  email: z.string().trim().default(""),
  address: z.string().trim().max(300).default(""),
  businessType: z.string().trim().max(120).default(""),
  source: z.enum(LEAD_SOURCES).default("Other"),
  service: z.enum(LEAD_SERVICES).default("Software development"),
  status: z.enum(LEAD_STAGES).optional(),
  notes: z.string().trim().max(2000).default(""),
  callOutcome: z.enum(CALL_OUTCOMES).optional(),
  callStatus: z.enum(LEAD_STAGES).optional(),
  callNext: optionalDay,
  callNote: z.string().trim().max(1000).default(""),
});

/** One call-log entry, added to or edited on an existing lead. */
export const callEntrySchema = z.object({
  leadId: z.string().trim().min(1),
  index: z.coerce.number().int().min(0).optional(),
  callOutcome: z.enum(CALL_OUTCOMES, { error: "Choose Answered or Not Answered." }),
  callStatus: z.enum(LEAD_STAGES).optional(),
  callNext: optionalDay,
  callNote: z.string().trim().max(1000).default(""),
});
