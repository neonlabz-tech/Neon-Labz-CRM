import { param, type SearchParams } from "./pagination";
import type { SessionUser } from "@/types";

/**
 * Whose reports a person sees. The Super Admin sees everyone's reports (or one project manager's) and can add,
 * edit and delete any of them, so the work carries on when a project manager leaves; own=1 shows only the Super Admin's own.
 */
export function reportScope(user: Pick<SessionUser, "role" | "username">, sp: SearchParams) {
  const own = user.role !== "superadmin" || param(sp, "own") === "1";
  const pm = param(sp, "pm");
  const owner: Record<string, unknown> = own ? { owner: user.username } : pm ? { owner: pm } : {};
  return { own, pm, readOnly: false, owner };
}
