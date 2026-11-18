import { z } from "zod";
import { ISO_DATE } from "@/lib/dates";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ISSUE_TYPES } from "@/lib/issues";

const long = z.string().trim().max(3000).default("");

export const issueSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Issue title is required.").max(200),
  projectCode: z.string().min(1, "Choose a project."),
  status: z.enum(Object.keys(ISSUE_STATUSES) as [keyof typeof ISSUE_STATUSES], "Choose a status."),
  priority: z.enum(Object.keys(ISSUE_PRIORITIES) as [keyof typeof ISSUE_PRIORITIES], "Choose a priority."),
  type: z.enum(Object.keys(ISSUE_TYPES) as [keyof typeof ISSUE_TYPES], "Choose a type."),
  assignee: z.string().trim().default(""),
  dueDate: z.union([z.literal(""), z.string().regex(ISO_DATE, "Choose a valid date.")]).default(""),
  description: long,
  steps: long,
  expected: long,
  audience: z.enum(["", "pm", "marketing", "both"]).default(""),
});
