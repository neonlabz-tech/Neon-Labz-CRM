import { periodRegex } from "./finance";

/** Rows whose text date (YYYY-MM-DD) falls in the chosen period; no period means everything. */
export function dateIn(prefix: string, ...fields: string[]): Record<string, unknown> {
  const regex = periodRegex(prefix);
  if (!regex) return {};
  return fields.length === 1 ? { [fields[0]!]: regex } : { $or: fields.map((field) => ({ [field]: regex })) };
}

/** The same period as real dates, for fields stored as timestamps. */
export function timeIn(prefix: string): { $gte: Date; $lt: Date } | undefined {
  if (!prefix) return undefined;
  const [year = 0, month] = prefix.split("-").map(Number);
  return month ? { $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) } : { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) };
}

export const group = (field: string, match: Record<string, unknown> = {}) => [{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }];
/** Like `group`, and also keeps the first few names so a chart can list what is behind each slice. */
export const groupNamed = (field: string, nameField: string, match: Record<string, unknown> = {}) => [
  { $match: match },
  { $group: { _id: `$${field}`, n: { $sum: 1 }, names: { $firstN: { input: `$${nameField}`, n: 4 } } } },
];

export const sum = (field: string, match: Record<string, unknown> = {}) => [{ $match: match }, { $group: { _id: null, n: { $sum: `$${field}` } } }];

export const periodNote = (year: string, month: string, months: readonly string[]) =>
  `${month ? months[Number(month) - 1] : "All months"} ${year || "all years"}`;
