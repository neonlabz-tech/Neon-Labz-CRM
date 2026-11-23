import sanitizeHtml from "sanitize-html";

const SIZES: Record<string, string> = {
  "1": "10px", "2": "13px", "3": "16px", "4": "18px", "5": "24px", "6": "32px", "7": "48px",
  "xx-small": "10px", "x-small": "12px", small: "13px", medium: "16px", large: "18px", "x-large": "24px", "xx-large": "32px", "xxx-large": "48px",
};
const COLOR = /^(#([0-9a-f]{3}|[0-9a-f]{6})|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]{3,20})$/i;

/** Turns the old font tag and named sizes into plain styles so only a short list of styles has to be allowed. */
function normalise(tag: string, attribs: Record<string, string>): { tagName: string; attribs: Record<string, string> } {
  const style: string[] = attribs.style ? [attribs.style] : [];
  if (tag === "font") {
    if (attribs.color && COLOR.test(attribs.color)) style.push(`color: ${attribs.color}`);
    if (attribs.face && /^[\w\s,"'-]{1,120}$/.test(attribs.face)) style.push(`font-family: ${attribs.face}`);
    if (attribs.size && SIZES[attribs.size]) style.push(`font-size: ${SIZES[attribs.size]}`);
  }
  const joined = style.join("; ").replace(/font-size:\s*([a-z-]+)/gi, (match, size: string) => (SIZES[size.toLowerCase()] ? `font-size: ${SIZES[size.toLowerCase()]}` : match));
  const next: Record<string, string> = joined ? { style: joined } : {};
  return { tagName: tag === "font" ? "span" : tag, attribs: next };
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "div", "br", "span", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "code", "sub", "sup", "a", "table", "thead", "tbody", "tr", "td", "th"],
  allowedAttributes: { "*": ["style"], a: ["href", "title", "target", "rel"], td: ["colspan", "rowspan", "style"], th: ["colspan", "rowspan", "style"] },
  allowedStyles: {
    "*": {
      color: [COLOR],
      "background-color": [COLOR],
      "font-size": [/^\d{1,3}(\.\d+)?(px|pt|em|rem|%)$/i],
      "font-family": [/^[\w\s,"'-]{1,120}$/],
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(bold|normal|[1-9]00)$/i],
      "font-style": [/^(italic|normal)$/i],
      "text-decoration": [/^(underline|line-through)$/i],
      width: [/^\d{1,3}(\.\d+)?(px|%|mm|cm)$/i],
      "vertical-align": [/^(top|middle|bottom)$/i],
      border: [/^\d{1,2}px\s+(solid|dashed|dotted)\s+(#[0-9a-f]{3,8}|[a-z]{3,20})$/i],
      padding: [/^\d{1,2}px(\s+\d{1,2}px){0,3}$/i],
    },
  },
  transformTags: { font: (tag, attribs) => normalise(tag, attribs), span: (tag, attribs) => normalise(tag, attribs), div: (tag, attribs) => normalise(tag, attribs), p: (tag, attribs) => normalise(tag, attribs) },
  disallowedTagsMode: "discard",
};

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Safe HTML to store: only formatting tags and a short list of styles survive. */
export function cleanRich(value: string): string {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  return sanitizeHtml(raw, OPTIONS).trim();
}

/** HTML for showing a saved value. Older plain text becomes lines, so nothing saved before the editor is lost. */
export function richToHtml(value: string): string {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  if (/<[a-z][\s\S]*>/i.test(raw)) return cleanRich(raw);
  return raw.split(/\r?\n/).map((line) => `<div>${escape(line) || "<br>"}</div>`).join("");
}

/** True when the HTML holds some text, not just tags and spaces. */
export function richHasText(value: string): boolean {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim().length > 0;
}

/** Plain lines from formatted text, one per list item or paragraph. Used to keep the simple "items" list in step with the editor. */
export function richToLines(value: string): string[] {
  const marked = String(value ?? "")
    .replace(/<\/(li|p|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " | ");
  return marked
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").replace(/\s*\|\s*$/, "").trim().replace(/^[•·▪◦‣*–—-]+\s*/, ""))
    .filter((line) => line.length > 1);
}

/** The old "one item per line" list as formatted text, so editing an older package starts with its items already in a list. */
export function linesToRich(lines: string[] | undefined): string {
  const list = (lines ?? []).map((l) => l.trim()).filter(Boolean);
  return list.length ? `<ul>${list.map((l) => `<li>${escape(l)}</li>`).join("")}</ul>` : "";
}

/** What a quotation shows when a package is chosen: the short quote summary if the package has one, otherwise the full details. */
export function quoteScope(pkg: { summary?: string; description?: string; features?: string[]; included?: string }) {
  const full = packageScopeHtml(pkg.description ?? "", pkg.features ?? [], pkg.included ?? "");
  const summary = richHasText(pkg.summary ?? "") ? richToHtml(pkg.summary ?? "") : "";
  return { scope: summary || full, fullScope: full, hasSummary: Boolean(summary) };
}

/** Combines the package description with its rich included items, keeping older feature lists readable. */
export function packageScopeHtml(description: string, features: string[], included: string): string {
  if (included.trim()) return [richToHtml(description), richToHtml(included)].filter(Boolean).join("");
  if (/<[a-z][\s\S]*>/i.test(description)) {
    const list = features.length ? `<ul>${features.map((feature) => `<li>${escape(feature)}</li>`).join("")}</ul>` : "";
    return [richToHtml(description), list].filter(Boolean).join("");
  }
  return richToHtml([description, ...features.map((feature) => `• ${feature}`)].filter(Boolean).join("\n"));
}
