import { z } from "zod";
import { ISO_DATE } from "@/lib/dates";

const day = z.union([z.literal(""), z.string().regex(ISO_DATE, "Choose a valid date.")]).default("");
const short = z.string().trim().max(300).default("");
const long = z.string().trim().max(6000).default("");
const head = {
  id: z.string().optional(),
  projectCode: z.string().min(1, "Choose a project."),
  date: day,
};

export const srsSchema = z.object({
  ...head,
  title: z.string().trim().min(1, "SRS title is required.").max(200),
  preparedFor: short, introduction: long, functional: long, nonFunctional: long, assumptions: long,
});

/** A list sent as JSON from the editor; rows with every cell empty are dropped. */
const rows = <T extends z.ZodRawShape>(shape: T) =>
  z.string().default("[]").transform((raw, ctx) => {
    try {
      const parsed = z.array(z.object(shape)).max(60).safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data.filter((row) => Object.values(row).some((v) => String(v).trim()));
    } catch {
      /* fall through */
    }
    ctx.addIssue({ code: "custom", message: "Check the table rows." });
    return z.NEVER;
  });
const cell = z.string().trim().max(600).default("");

export const proposalSchema = z.object({
  ...head,
  title: z.string().trim().min(1, "Proposal title is required.").max(200),
  subtitle: short, preparedFor: short, validity: short, companyScope: long, summary: long,
  customerTitle: short, customerRole: short, customerFeatures: long, adminTitle: short, adminRole: short, adminFeatures: long,
  stack: rows({ layer: cell, technology: cell, purpose: cell }),
  brand: rows({ title: cell, text: cell }),
  packageName: short, packageInvestment: short,
  packageStats: rows({ value: cell, label: cell }),
  budget: rows({ deliverable: cell, fee: cell, amount: cell }),
  totalAmount: short, totalNote: short, duration: short, startDate: day, launchDate: day, terms: long,
  clientSignName: short, clientSignTitle: short, clientSignDate: day,
  companySignName: short, companySignTitle: short, companySignDate: day,
});

export const videoSchema = z.object({
  ...head,
  title: z.string().trim().min(1, "Video title is required.").max(200),
  url: z.union([z.literal(""), z.string().trim().max(500).regex(/^https?:\/\//i, "The video link must start with http:// or https://.")]).default(""),
  notes: long,
});
