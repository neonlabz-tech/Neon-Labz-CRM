export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** A date is allowed when it is not before today, unless it is the date already saved on the record. */
export function dateIsAllowed(value: string, existing = ""): boolean {
  const day = value.slice(0, 10);
  if (!day) return true;
  const kept = existing.slice(0, 10);
  if (kept && day === kept) return true;
  return day >= todayISO();
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
