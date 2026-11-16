export const WORK_TYPES = ["software", "marketing", "both"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

/** Work a client buys, worked out from service / package names. "both" or a software + marketing mix is both. */
export function workTypeOf(...services: (string | undefined | null)[]): WorkType {
  const text = services.filter(Boolean).join(" ").toLowerCase();
  if (!text.trim()) return "software";
  if (/\bboth\b/.test(text)) return "both";
  const marketing = /marketing|social|seo|content|ads?\b|brand/.test(text);
  const software = /software|web|app|mobile|crm|erp|development|ecommerce|e-commerce|design|api/.test(text);
  if (marketing && software) return "both";
  return marketing ? "marketing" : "software";
}

const MARKETING_WORDS = "marketing|social|seo|content|ads?\\b|brand";

/** A client's work type; clients saved before workType existed are read from their service. */
export const workTypeOfClient = (client: { workType?: string | null; service?: string | null }): WorkType =>
  client.workType === "software" || client.workType === "marketing" || client.workType === "both" ? client.workType : workTypeOf(client.service);

/** Which clients a role works with. Clients saved before workType existed are placed by their service. */
export function clientWorkFilter(role: string): Record<string, unknown> {
  const legacy = { workType: null };
  if (role === "pm") return { $or: [{ workType: { $in: ["software", "both"] } }, { ...legacy, service: { $not: new RegExp(MARKETING_WORDS, "i") } }] };
  if (role === "marketing") return { $or: [{ workType: { $in: ["marketing", "both"] } }, { ...legacy, service: new RegExp(MARKETING_WORDS, "i") }] };
  return {};
}

export const worksFor = (type: string, lane: "software" | "marketing") => type === "both" || type === lane;
