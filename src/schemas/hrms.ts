import { z } from "zod";
import { MIN_PASSWORD } from "./auth";
import { ISO_DATE } from "@/lib/dates";
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUSES, EMPLOYMENT_STATUSES, HR_ROLES, LEAVE_TYPES } from "@/lib/hrms";
import { EMAIL_ERROR, formatPhone, PHONE_ERROR, validEmail, validSriLankanPhone } from "@/lib/phone";

const day = z.string().regex(ISO_DATE, "Choose a date.");
const optionalId = z.string().optional();

export const departmentSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, "Enter the department name.").max(80),
  role: z.enum(["pm", "marketing", "sales"], "Choose how the admin of this department signs in."),
});

export const employeeSchema = z
  .object({
    id: optionalId,
    name: z.string().trim().min(2, "Enter the full name.").max(200),
    email: z.string().trim().toLowerCase().refine(validEmail, EMAIL_ERROR),
    phone: z.string().trim().refine(validSriLankanPhone, PHONE_ERROR).transform(formatPhone),
    join: day,
    role: z.enum(HR_ROLES, "Choose a role."),
    customRole: z.string().trim().max(200).default(""),
    status: z.enum(EMPLOYMENT_STATUSES, "Choose an employment status."),
    department: z.string().min(1, "Choose a department. Add the department before adding people."),
    memberType: z.enum(["admin", "team"], "Choose Admin or Team member."),
    password: z.string().trim().default(""),
    confirm: z.string().trim().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.role === "Custom Role" && !v.customRole) ctx.addIssue({ code: "custom", path: ["customRole"], message: "Enter the role title." });
    if (!v.id && v.password.length < MIN_PASSWORD) ctx.addIssue({ code: "custom", path: ["password"], message: `Use at least ${MIN_PASSWORD} characters.` });
    if (v.id && v.password && v.password.length < MIN_PASSWORD) ctx.addIssue({ code: "custom", path: ["password"], message: `Use at least ${MIN_PASSWORD} characters.` });
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords do not match." });
  });

export const leaveSchema = z.object({
  id: optionalId,
  employee: z.string().min(1, "Select a valid employee."),
  date: day,
  type: z.enum(LEAVE_TYPES, "Choose a leave type."),
  description: z.string().trim().min(1, "Describe the leave.").max(1500),
});

export const activitySchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, "Enter the activity name.").max(200),
  category: z.enum(ACTIVITY_CATEGORIES, "Choose a category."),
  date: day,
  status: z.enum(ACTIVITY_STATUSES, "Choose a status."),
  description: z.string().trim().min(1, "Describe the activity.").max(1500),
});
