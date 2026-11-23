import { param, type SearchParams } from "./pagination";
import type { SessionUser } from "@/types";

/**
 * Whose reports a person sees. The Super Admin's own view (own=1) can be changed; otherwise the Super Admin
 * looks at one project manager's reports, or everyone else's, without changing them.
 */
export function reportScope(user: Pick<SessionUser, "role" | "username">, sp: SearchParams) {
  const own = user.role !== "superadmin" || param(sp, "own") === "1";
  const pm = param(sp, "pm");
  const owner: Record<string, unknown> = own ? { owner: user.username } : pm === "PM" ? { owner: { $regex: "^PM_" } } : pm ? { owner: pm } : { owner: { $ne: user.username } };
  return { own, pm, readOnly: !own, owner };
}
