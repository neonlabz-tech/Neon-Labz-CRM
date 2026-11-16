import type { Role } from "@/lib/permissions";

export type SessionUser = {
  username: string;
  role: Role;
  fullName: string;
  email: string;
  mustChangePassword: boolean;
};

export type ActionState = { ok: boolean; message: string; errors?: Record<string, string> };
export const idle: ActionState = { ok: false, message: "" };
