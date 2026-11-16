import { z } from "zod";
import { USERNAME_PATTERN } from "@/lib/permissions";

export const MIN_PASSWORD = 8;

const password = z.string().trim().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`).max(100);
const username = z
  .string()
  .trim()
  .toUpperCase()
  .regex(USERNAME_PATTERN, "Use your username, for example PM_001 or EMP_001.");

export const loginSchema = z.object({ username, password: z.string().trim().min(1, "Enter your password.") });

export const changePasswordSchema = z
  .object({ current: z.string().trim().min(1, "Enter your current password."), next: password, confirm: z.string().trim() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The two passwords do not match." })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a different password from the current one." });

export const resetPasswordSchema = z
  .object({ token: z.string().min(10), next: password, confirm: z.string().trim() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The two passwords do not match." });

export const forgotSchema = z.object({ identifier: z.string().trim().min(3, "Enter your username or email.").max(120) });
