export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
export const PAY_STATUSES = ["Paid", "Non-paid"] as const;
export const DEFAULT_CATEGORIES = [
  "Office Rent", "Utility Bill", "Internet Connection", "Telephone Bill",
  "Software & Technology Expense", "Marketing & Sales Expense", "Legal & Administration Expense",
] as const;

/** Dates are saved as YYYY-MM-DD, so a month filter is a simple prefix match. */
export function periodPrefix(year: string, month: string): string {
  if (!/^\d{4}$/.test(year)) return "";
  return /^(0[1-9]|1[0-2])$/.test(month) ? `${year}-${month}` : year;
}

export function monthLabel(key: string): string {
  return `${MONTHS[Number(key.slice(5, 7)) - 1] ?? ""} ${key.slice(0, 4)}`.trim();
}

type Query = Record<string, string | string[] | undefined>;
const first = (q: Query, key: string) => {
  const v = q[key];
  return (Array.isArray(v) ? v[0] : v)?.trim();
};

/** With no year or month in the address the current period is shown; "all" removes the limit. */
export function readPeriod(q: Query, today: string) {
  const pick = (key: string, fallback: string) => {
    const v = first(q, key);
    return v === undefined ? fallback : v === "all" ? "" : v;
  };
  const year = pick("year", today.slice(0, 4));
  const month = year ? pick("month", today.slice(5, 7)) : "";
  const day = (key: string) => { const v = first(q, key) ?? ""; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ""; };
  const from = day("from");
  const to = day("to");
  const ranged = Boolean(from || to);
  return { year, month, prefix: ranged ? "" : periodPrefix(year, month), from, to };
}

/** The date condition for a period: a from/to range when one is set, otherwise the year or month prefix. */
export function dateRange(p: { prefix: string; from: string; to: string }) {
  if (p.from || p.to) return { ...(p.from ? { $gte: p.from } : {}), ...(p.to ? { $lte: p.to } : {}) };
  return periodRegex(p.prefix);
}

export const periodRegex = (prefix: string) => (prefix ? { $regex: `^${prefix}` } : undefined);
