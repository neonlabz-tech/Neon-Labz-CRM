export const PAGE_SIZE = 20;

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(searchParams: SearchParams, name: string): string {
  const value = searchParams[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** The most rows one "All" view loads. */
export const ALL_LIMIT = 1000;

/** The page number from the address; 0 means "All", which shows every row in one scrolling box. */
export function pageOf(searchParams: SearchParams): number {
  if (param(searchParams, "page") === "all") return 0;
  return Math.max(1, Math.floor(Number(param(searchParams, "page"))) || 1);
}

export const skipOf = (page: number) => (page === 0 ? 0 : (page - 1) * PAGE_SIZE);
export const limitOf = (page: number) => (page === 0 ? ALL_LIMIT : PAGE_SIZE);

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
