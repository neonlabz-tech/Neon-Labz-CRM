/** Icons a package can carry. They are drawn as inline SVG, so they show up in the app and in every quotation PDF without any image file. */
export type PackageIcon = { id: string; label: string; paths: string };

export const PACKAGE_ICONS: PackageIcon[] = [
  { id: "web", label: "Website", paths: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>' },
  { id: "mobile", label: "Mobile app", paths: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>' },
  { id: "marketing", label: "Marketing", paths: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>' },
  { id: "social", label: "Social media", paths: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>' },
  { id: "seo", label: "SEO", paths: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>' },
  { id: "design", label: "Design", paths: '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>' },
  { id: "ai", label: "AI", paths: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>' },
  { id: "ecommerce", label: "E-commerce", paths: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>' },
  { id: "hosting", label: "Hosting", paths: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>' },
  { id: "video", label: "Video", paths: '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>' },
  { id: "support", label: "Support", paths: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>' },
  { id: "analytics", label: "Analytics", paths: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>' },
  { id: "software", label: "Software", paths: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
  { id: "package", label: "General", paths: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>' },
];

export const ICON_IDS = PACKAGE_ICONS.map((icon) => icon.id);

/** Small icons for the document itself (contact lines, notes). */
export const UI_ICONS = {
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
} as const;

const RULES: [string, RegExp][] = [
  ["ai", /\bai\b|chatbot|automation|machine learning|artificial/i],
  ["ecommerce", /e-?commerce|online store|shop|cart/i],
  ["mobile", /mobile|android|\bios\b|\bapp\b|application/i],
  ["seo", /\bseo\b|search engine/i],
  ["social", /social|facebook|instagram|tiktok|content/i],
  ["marketing", /marketing|advert|\bads?\b|campaign|promotion/i],
  ["design", /design|brand|logo|graphic/i],
  ["video", /video|animation|motion|reel/i],
  ["hosting", /host|cloud|server|domain|maintenance/i],
  ["support", /support|care plan|retainer/i],
  ["analytics", /analytic|report|dashboard/i],
  ["web", /web|site|landing|wordpress|portfolio/i],
  ["software", /software|system|crm|erp|develop|custom/i],
];

/** Picks an icon from the package name when nobody chose one. */
export function guessIcon(name: string, category = ""): string {
  for (const [id, pattern] of RULES) if (pattern.test(name)) return id;
  if (/market/i.test(category)) return "marketing";
  if (/software/i.test(category)) return "software";
  return "package";
}

export const resolveIcon = (icon: string | null | undefined, name: string, category = ""): string =>
  icon && ICON_IDS.includes(icon) ? icon : guessIcon(name, category);

export const iconPaths = (id: string): string => (PACKAGE_ICONS.find((icon) => icon.id === id) ?? PACKAGE_ICONS[PACKAGE_ICONS.length - 1]!).paths;

/** A finished SVG string with real colours, because PDFs drawn in the browser cannot read `currentColor`. */
export const svgIcon = (paths: string, size = 24, color = "#873CFF", stroke = 2): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
