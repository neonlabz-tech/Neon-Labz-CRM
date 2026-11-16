import { LEAD_SERVICES, LEAD_SOURCES, LEAD_STAGES } from "@/models/lead";
import { formatPhone, phoneDigits } from "./phone";

/** Splits CSV text into rows. Handles quotes, commas, semicolons or tabs, and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const source = String(text ?? "").replace(/^﻿/, "");
  const first = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = false; else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

/** Accepts 2026-01-31 and 31/01/2026 style dates; anything else gives the fallback. */
export function csvDate(value: string, fallback: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2}|\d{4})$/);
  if (!parts) return fallback;
  let day = Number(parts[1]);
  let month = Number(parts[2]);
  let year = Number(parts[3]);
  if (parts[3]!.length === 2) year += year >= 70 ? 1900 : 2000;
  if (month > 12 && day <= 12) [day, month] = [month, day];
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00Z`);
  return check.getUTCFullYear() === year && check.getUTCMonth() + 1 === month && check.getUTCDate() === day ? iso : fallback;
}

const FIELDS: Record<string, string[]> = {
  business: ["business", "customer", "business / customer", "business/customer", "name", "customer name"],
  phone: ["phone", "mobile", "contact number"],
  date: ["date", "lead date"],
  source: ["source"],
  service: ["service", "interested service"],
  status: ["status", "lead status", "stage"],
  email: ["email", "email address"],
  address: ["address"],
  businessType: ["business type", "industry", "type of business"],
  next: ["next", "next follow-up", "next follow up"],
  notes: ["notes", "note"],
  owner: ["owner", "assigned to", "salesperson", "sales person"],
};
const ORDER = ["business", "phone", "date", "source", "service", "status", "email", "address", "next", "notes", "businessType", "owner"] as const;
type Field = (typeof ORDER)[number];

export type CsvLead = {
  business: string; phone: string; date: string; source: (typeof LEAD_SOURCES)[number]; service: (typeof LEAD_SERVICES)[number];
  status: (typeof LEAD_STAGES)[number]; email: string; address: string; next: string; notes: string; businessType: string; owner: string;
};

function headerMap(headers: string[]): Partial<Record<Field, number>> | null {
  const map: Partial<Record<Field, number>> = {};
  headers.forEach((header, index) => {
    const key = header.trim().toLowerCase().replace(/\s+/g, " ");
    for (const field of ORDER) if (FIELDS[field]!.includes(key)) map[field] = index;
  });
  return map.business === undefined ? null : map;
}

function phoneOf(value: string): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("94") && digits.length > 10) digits = `0${digits.slice(2)}`;
  if (digits.length === 9) digits = `0${digits}`;
  return phoneDigits(digits).length === 10 ? formatPhone(digits.slice(0, 10)) : "";
}

function serviceOf(value: string): CsvLead["service"] {
  const text = value.trim().toLowerCase();
  if (text.startsWith("soft")) return "Software development";
  if (text.startsWith("market")) return "Marketing";
  if (text.includes("both")) return "Both";
  return LEAD_SERVICES.find((item) => item.toLowerCase() === text) ?? "Software development";
}

function stageOf(value: string): CsvLead["status"] {
  const text = value.trim().toLowerCase();
  if (text === "contacted") return "Connected";
  if (text === "success") return "Converted";
  if (text === "failed") return "Lost";
  if (text === "in-progress" || text === "in progress") return "Follow-up";
  return LEAD_STAGES.find((item) => item.toLowerCase() === text) ?? "New";
}

/** Turns CSV text into leads. Rows with no business name are reported, not dropped silently. */
export function readLeadCsv(text: string, today: string): { leads: { line: number; lead: CsvLead }[]; problems: string[]; error?: string } {
  const rows = parseCsv(text);
  if (!rows.length) return { leads: [], problems: [], error: "The CSV file has no lead rows." };
  const map = headerMap(rows[0]!);
  const body = map ? rows.slice(1) : rows;
  if (!body.length) return { leads: [], problems: [], error: "The CSV file has headings but no lead rows." };
  const headers = map ? rows[0]! : [];
  const used = new Set(Object.values(map ?? {}));
  const leads: { line: number; lead: CsvLead }[] = [];
  const problems: string[] = [];
  body.forEach((row, index) => {
    const line = map ? index + 2 : index + 1;
    const get = (field: Field) => {
      const position = map ? map[field] : ORDER.indexOf(field);
      return position === undefined ? "" : (row[position] ?? "").trim();
    };
    const business = get("business");
    if (!business) { problems.push(`Row ${line} has no customer name.`); return; }
    const extras = headers.flatMap((header, i) => (used.has(i) || !header.trim() || !(row[i] ?? "").trim() ? [] : [`${header.trim()}: ${(row[i] ?? "").trim()}`]));
    const source = get("source").toLowerCase().replace(/\s+/g, "");
    leads.push({
      line,
      lead: {
        business,
        phone: phoneOf(get("phone")),
        date: csvDate(get("date"), today),
        source: LEAD_SOURCES.find((item) => item.toLowerCase().replace(/\s+/g, "") === source) ?? "Other",
        service: serviceOf(get("service")),
        status: stageOf(get("status")),
        email: get("email"),
        address: get("address"),
        next: csvDate(get("next"), ""),
        notes: [get("notes"), ...extras].filter(Boolean).join("\n"),
        businessType: get("businessType"),
        owner: get("owner"),
      },
    });
  });
  return { leads, problems };
}
