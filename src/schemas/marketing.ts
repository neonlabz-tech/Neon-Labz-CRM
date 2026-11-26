import { z } from "zod";
import { ISO_DATE } from "@/lib/dates";
import { POST_STATUS, POST_TYPES } from "@/lib/marketing";

const text = z.string().trim().max(500).default("");
const day = z.union([z.literal(""), z.string().regex(ISO_DATE, "Choose a valid date.")]).default("");

export const infoSchema = z.object({
  clientCode: z.string().min(1, "Choose a client."),
  brandName: z.string().trim().min(1, "Project ID, brand name, and main contact name are required.").max(500),
  legalName: text, industry: text, tagline: text,
  mainContactName: z.string().trim().min(1, "Project ID, brand name, and main contact name are required.").max(500),
  mainContactTitle: text, assignedContactName: text, assignedContactTitle: text,
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]).default(""),
  phone: text, website: text, address: text, hours: text, preferredContact: text,
  primaryColor: text, secondaryColors: text, fonts: text,
});

const post = z.object({ date: day, time: z.string().trim().max(20).default(""), topic: z.string().trim().max(300).default(""), type: z.enum(POST_TYPES).default("Poster"), status: z.enum(POST_STATUS).default("Pending") });
const adText = z.string().trim().max(600).default("");
const ad = z.object({ date: day, time: adText, platforms: adText, adType: adText, objective: adText, target: adText, product: adText, offer: adText, duration: adText, message: adText, creative: adText });
const month = z.object({ label: z.string().trim().min(1).max(60), startDate: day, endDate: day, theme: z.string().trim().max(300).default(""), posts: z.array(post).max(120), ad });

export const planSchema = z
  .object({
    id: z.string().optional(),
    clientCode: z.string().min(1, "Choose a client."),
    title: z.string().trim().min(1, "Choose a client, title, and the plan start and end dates.").max(160),
    startDate: z.string().regex(ISO_DATE, "Choose a client, title, and the plan start and end dates."),
    endDate: z.string().regex(ISO_DATE, "Choose a client, title, and the plan start and end dates."),
    address: z.string().trim().max(300).default(""),
    cadence: z.string().trim().max(200).default(""),
    confirmNotes: z.string().trim().max(2000).default(""),
    months: z.string().transform((raw, ctx) => {
      try {
        const parsed = z.array(month).min(1, "Add at least one month.").safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
        ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Check the months." });
      } catch {
        ctx.addIssue({ code: "custom", message: "Add at least one month." });
      }
      return z.NEVER;
    }),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "The end date cannot be before the start date." })
  .refine((v) => v.months.some((m) => m.posts.some((p) => p.topic)), { path: ["months"], message: "Add at least one post with a topic." });

export const reportSchema = z
  .object({
    id: z.string().optional(),
    clientCode: z.string().min(1, "Choose a client from Client info."),
    title: z.string().trim().max(200).default(""),
    startDate: z.string().regex(ISO_DATE, "Choose the report start date."),
    endDate: z.string().regex(ISO_DATE, "Choose the report end date."),
    contentDirection: z.string().trim().max(3000).default(""),
    clientSummary: z.string().trim().min(1, "Add the client summary.").max(4000),
    metaSummary: z.string().trim().max(300).default(""),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "The end date is before the start date." });

const reportRow = z.object({ label: z.string().trim().max(120).default(""), value: z.string().trim().max(200).default("") });

/** One platform of a marketing report, as the form sends it in a single JSON field. */
export const platformInputSchema = z.object({
  intro: z.string().trim().max(2000).default(""),
  analysis: z.string().trim().max(2000).default(""),
  metrics: z.array(reportRow).max(40).default([]),
  posts: z.array(z.object({ title: z.string().trim().max(300).default(""), views: z.string().trim().max(60).default("") })).max(30).default([]),
  audience: z.array(reportRow).max(30).default([]),
  /** `key` names the file input of a new screenshot; `url` is set for one that is already saved. */
  shots: z.array(z.object({ key: z.string().max(40).default(""), url: z.string().max(1000).default(""), caption: z.string().trim().max(200).default("") })).max(12).default([]),
});
