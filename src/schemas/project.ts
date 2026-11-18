import { z } from "zod";
import { ISO_DATE } from "@/lib/dates";
import { DEPARTMENTS, PROJECT_STATUS, PROJECT_TYPES } from "@/lib/projects";

const day = z.union([z.literal(""), z.string().regex(ISO_DATE, "Choose a valid date.")]).default("");
const start = z.string({ error: "Choose a start date." }).regex(ISO_DATE, "Choose a start date.");
const due = z.string({ error: "Choose a due date." }).regex(ISO_DATE, "Choose a due date.");
const ordered = (v: { startDate: string; dueDate: string }) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate;
const orderedMsg = { path: ["dueDate"], message: "Due date must be on or after the start date." };

export const projectSchema = z
  .object({
    clientCode: z.string({ error: "Choose a client." }).min(1, "Choose a client."),
    name: z.string().trim().min(1, "Project name is required.").max(160),
    type: z.enum(PROJECT_TYPES),
    startDate: start,
    dueDate: due,
    description: z.string().trim().max(3000).default(""),
  })
  .refine(ordered, orderedMsg);

export const projectUpdateSchema = z
  .object({
    code: z.string().min(1),
    name: z.string().trim().min(1, "Project name is required.").max(160),
    status: z.enum(Object.keys(PROJECT_STATUS) as [keyof typeof PROJECT_STATUS]),
    startDate: day,
    dueDate: day,
    description: z.string().trim().max(3000).default(""),
  })
  .refine(ordered, orderedMsg);

const codes = z.array(z.string().trim().toUpperCase()).default([]);

export const milestoneSchema = z
  .object({
    projectCode: z.string().min(1),
    id: z.string().optional(),
    title: z.string().trim().min(1, "Milestone name is required.").max(160),
    startDate: day,
    dueDate: z.string().min(1, "Due date is required.").regex(ISO_DATE, "Choose a valid date."),
    department: z.enum(DEPARTMENTS),
    audience: z.enum(["", "pm", "marketing", "both"]).default(""),
    assignees: codes.refine((list) => list.some(Boolean), "Assign at least one employee to this milestone."),
  })
  .refine(ordered, orderedMsg);

export const taskSchema = z
  .object({
    id: z.string().optional(),
    projectCode: z.string().min(1),
    milestoneId: z.string().min(1, "Choose a milestone."),
    title: z.string().trim().min(1, "Task title is required.").max(200),
    priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
    assigneeCode: z.string().trim().toUpperCase().default(""),
    startDate: day,
    dueDate: day,
    description: z.string().trim().max(12000).default(""),
    status: z.enum(["not-started", "in-progress", "completed", "done"]).default("not-started"),
  })
  .refine(ordered, { path: ["dueDate"], message: "Due date cannot be before the start date." });
