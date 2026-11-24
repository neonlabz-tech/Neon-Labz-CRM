import { param, type SearchParams } from "./pagination";

/** The Super Admin's "Own projects" menu shows only records the Super Admin made. */
export function ownView(role: string, sp: SearchParams): boolean {
  return role === "superadmin" && param(sp, "own") === "1";
}

/** Keeps the own view switched on through search, filters and paging. */
export const keepOwn = (own: boolean): Record<string, string> => (own ? { own: "1" } : {});

/**
 * The Super Admin's own leads: made inside "Own projects" (own: true), or made before the flag existed (no `own` field at all).
 * Only a lead the Super Admin added from the SD list is marked own: false.
 */
export const ownLeads = (username: string): Record<string, unknown> => ({ owner: username, own: { $ne: false } });

/** What the SD list shows the Super Admin: every lead that is not one of the Super Admin's own. */
export const salesLeads = (username: string): Record<string, unknown> => ({ $nor: [ownLeads(username)] });
