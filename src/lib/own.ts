import { param, type SearchParams } from "./pagination";

/** The Super Admin's "Own projects" menu shows only records the Super Admin made. */
export function ownView(role: string, sp: SearchParams): boolean {
  return role === "superadmin" && param(sp, "own") === "1";
}

/** Keeps the own view switched on through search, filters and paging. */
export const keepOwn = (own: boolean): Record<string, string> => (own ? { own: "1" } : {});
