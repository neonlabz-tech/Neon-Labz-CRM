import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  const parts = name.replace(/[_-]/g, " ").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "?";
  // A second part that starts with a number (as in SA_001) is not a name, so use the next letter of the first part.
  const second = /^\p{L}/u.test(parts[1] ?? "") ? parts[1]![0]! : parts.length > 1 ? (first[1] ?? "") : "";
  return (first[0] ?? "?").concat(second).toUpperCase();
}

export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/** "4 Nov 2026" from a YYYY-MM-DD string. */
export function formatDay(iso: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

/** "9:00 AM" from an HH:MM string. */
export function formatClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) return value || "—";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}
