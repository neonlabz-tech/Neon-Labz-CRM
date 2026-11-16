import { param, type SearchParams } from "./pagination";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** From / To dates (YYYY-MM-DD) and the chosen salesperson from the URL. Bad values are ignored. */
export function readRange(sp: SearchParams) {
  const from = param(sp, "from");
  const to = param(sp, "to");
  return { from: ISO.test(from) ? from : "", to: ISO.test(to) ? to : "", seller: param(sp, "seller") };
}

export type Range = ReturnType<typeof readRange>;

/** Mongo clause for a Date field between the two days, both included. */
export function dateRange(range: Range): Record<string, Date> | null {
  const clause: Record<string, Date> = {};
  if (range.from) clause.$gte = new Date(`${range.from}T00:00:00.000Z`);
  if (range.to) clause.$lte = new Date(`${range.to}T23:59:59.999Z`);
  return range.from || range.to ? clause : null;
}

/** Mongo clause for a YYYY-MM-DD string field between the two days. */
export function dayRange(range: Range): Record<string, string> | null {
  const clause: Record<string, string> = {};
  if (range.from) clause.$gte = range.from;
  if (range.to) clause.$lte = range.to;
  return range.from || range.to ? clause : null;
}

/** Monday to Sunday of the week that holds `today` (YYYY-MM-DD). */
export function thisWeek(today: string) {
  const day = new Date(`${today}T00:00:00Z`);
  const from = new Date(day);
  from.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * The days to filter by. `period` (today / week) replaces the typed From / To dates; anything else uses them.
 * `picked` is what the form shows, `range` is what the query uses.
 */
export function periodRange(sp: SearchParams, today: string) {
  const period = param(sp, "period");
  const picked = readRange(sp);
  const range = period === "today" ? { ...picked, from: today, to: today } : period === "week" ? { ...picked, ...thisWeek(today) } : picked;
  return { period, picked, range };
}
