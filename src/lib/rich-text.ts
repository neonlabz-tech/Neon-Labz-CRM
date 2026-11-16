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
  allowedTags: ["p", "div", "br", "span", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4"],
  allowedAttributes: { "*": ["style"] },
  allowedStyles: {
    "*": {
      color: [COLOR],
      "font-size": [/^\d{1,3}(\.\d+)?(px|pt|em|rem|%)$/i],
      "font-family": [/^[\w\s,"'-]{1,120}$/],
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(bold|normal|[1-9]00)$/i],
      "font-style": [/^(italic|normal)$/i],
      "text-decoration": [/^underline$/i],
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
