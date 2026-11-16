import type { ZodError } from "zod";
import type { ActionState } from "@/types";

export function invalid(error: ZodError): ActionState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return { ok: false, message: Object.values(errors)[0] ?? "Check the form and try again.", errors };
}

export const fail = (message: string): ActionState => ({ ok: false, message });
export const done = (message: string): ActionState => ({ ok: true, message });
