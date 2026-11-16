import { z } from "zod";
import { ISO_DATE } from "@/lib/dates";
import { MEETING_STATUS, RECURRENCES } from "@/lib/meetings";

export const meetingSchema = z.object({
  id: z.string().default(""),
  projectCode: z.string().trim().min(1, "Choose a project."),
  startDate: z.string().regex(ISO_DATE, "Choose a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time."),
  link: z.string().trim().min(1, "Add the meeting link.").max(300),
  recurrence: z.enum(Object.keys(RECURRENCES) as [keyof typeof RECURRENCES]),
  status: z.enum(Object.keys(MEETING_STATUS) as [keyof typeof MEETING_STATUS]).default("scheduled"),
});
