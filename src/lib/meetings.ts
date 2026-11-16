import { addDays, todayISO } from "./dates";

export const RECURRENCES = {
  none: "Don't repeat",
  daily: "Everyday",
  monday: "Every Monday",
  tuesday: "Every Tuesday",
  wednesday: "Every Wednesday",
  thursday: "Every Thursday",
  friday: "Every Friday",
} as const;

export const MEETING_STATUS = { scheduled: "Scheduled", conducted: "Conducted", cancelled: "Cancelled" } as const;
export type MeetingStatus = keyof typeof MEETING_STATUS;

export type Series = { startDate: string; recurrence: string; statusByDate?: Record<string, string> | null };
export type Occurrence = { date: string; status: MeetingStatus };

const WEEKDAY: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
const dayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** "Everyday" means every working day, Monday to Friday. */
function matches(series: Series, iso: string): boolean {
  if (iso < series.startDate) return false;
  if (series.recurrence === "daily") return dayOf(iso) >= 1 && dayOf(iso) <= 5;
  const weekday = WEEKDAY[series.recurrence];
  return weekday === undefined ? iso === series.startDate : dayOf(iso) === weekday;
}

export function meetingStatus(series: Series, iso: string): MeetingStatus {
  return (series.statusByDate?.[iso] as MeetingStatus | undefined) ?? "scheduled";
}

/** The first date on or after the start date that fits the repeat rule. */
export function firstMatch(series: Series): string {
  if (!series.startDate || series.recurrence === "none") return series.startDate;
  let cursor = series.startDate;
  for (let step = 0; step < 14; step += 1) {
    if (matches(series, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return series.startDate;
}

/** The next date still marked scheduled. Repeating meetings move on once a date is conducted or cancelled. */
export function upcomingDate(series: Series, today = todayISO()): string {
  if (series.recurrence === "none") return series.startDate;
  let cursor = series.startDate > today ? series.startDate : today;
  for (let step = 0; step < 370; step += 1) {
    if (matches(series, cursor) && meetingStatus(series, cursor) === "scheduled") return cursor;
    cursor = addDays(cursor, 1);
  }
  return series.startDate;
}

export function upcomingMeetings(series: Series, today = todayISO()): Occurrence[] {
  if (series.recurrence === "none") {
    const status = meetingStatus(series, series.startDate);
    return series.startDate < today || status !== "scheduled" ? [] : [{ date: series.startDate, status }];
  }
  const first = upcomingDate(series, today);
  const items: Occurrence[] = [{ date: first, status: meetingStatus(series, first) }];
  let cursor = addDays(first, 1);
  for (let guard = 0; items.length < 6 && guard < 120; guard += 1, cursor = addDays(cursor, 1)) {
    if (matches(series, cursor)) items.push({ date: cursor, status: meetingStatus(series, cursor) });
  }
  return items;
}

export function pastMeetings(series: Series, today = todayISO()): Occurrence[] {
  if (series.recurrence === "none") {
    const status = meetingStatus(series, series.startDate);
    return series.startDate < today || status !== "scheduled" ? [{ date: series.startDate, status }] : [];
  }
  const next = upcomingDate(series, today);
  const items: Occurrence[] = [];
  let cursor = series.startDate;
  for (let guard = 0; cursor < next && guard < 180; guard += 1, cursor = addDays(cursor, 1)) {
    if (matches(series, cursor)) items.push({ date: cursor, status: meetingStatus(series, cursor) });
  }
  return items.reverse();
}
