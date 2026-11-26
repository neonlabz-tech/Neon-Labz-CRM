import "server-only";
import { escapeHtml } from "./letterhead";
import { REPORT_PLATFORMS, emptyPlatform, platformHasData, type PlatformData } from "../marketing";

/** The marketing report PDF: a cover, then numbered sections with tables and screenshots, on fixed A4 pages.
 *  Every block has a known height (rows do not wrap, images are sized from their real pixels), so the pages are cut exactly and nothing is measured in the browser. */

export type ReportDocInput = {
  clientName: string; title: string; startDate: string; endDate: string; nextActions: string[]; contentDirection?: string | null; clientSummary: string;
  metaSummary?: string; metaShots?: { url: string; caption: string }[];
  platforms?: Partial<Record<string, Partial<PlatformData>>>;
};

type Assets = { logo: string; font: string };
type Block = { h: number; html: string };
type Img = { src: string; w: number; h: number };

const PAGE_H = 1122;
const SIDE = 56;
const CAPACITY = 975;
const CONTENT_W = 794 - SIDE * 2;
const ROW = 28;

/* ---------- images ---------- */

function pngSize(b: Buffer): [number, number] | null {
  return b.length > 24 && b.readUInt32BE(0) === 0x89504e47 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
}
function jpegSize(b: Buffer): [number, number] | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
function webpSize(b: Buffer): [number, number] | null {
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === "VP8L") { const bits = b.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]; }
  if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  return null;
}

/** Downloads an image we stored in R2 and inlines it, so the PDF does not depend on the browser being allowed to read it. */
async function embed(url: string): Promise<Img | null> {
  if (!url) return null;
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/`)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    const type = res.headers.get("content-type") || "image/png";
    const [w, h] = pngSize(buf) ?? jpegSize(buf) ?? webpSize(buf) ?? [1600, 1000];
    return { src: `data:${type};base64,${buf.toString("base64")}`, w: Math.max(1, w), h: Math.max(1, h) };
  } catch (error) {
    console.error("Report image could not be loaded", error);
    return null;
  }
}

/** The largest size that fits in the box with the same shape as the picture. */
const fit = (img: Img, boxW: number, boxH: number): [number, number] => {
  const scale = Math.min(boxW / img.w, boxH / img.h);
  return [Math.max(1, Math.round(img.w * scale)), Math.max(1, Math.round(img.h * scale))];
};

/* ---------- text and dates ---------- */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function day(iso: string, withYear: boolean): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}
function period(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return start === end ? day(start, true) : `${day(start, !sameYear)} – ${day(end, true)}`;
}
const listOf = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} & ${items[items.length - 1]}`);
const lines = (text: string, perLine: number) => text.split(/\n/).reduce((n, part) => n + Math.max(1, Math.ceil(part.length / perLine)), 0);

/* ---------- blocks ---------- */

const secTitle = (n: number, text: string): Block => ({ h: 52, html: `<h2 class="sec">${String(n).padStart(2, "0")} | ${escapeHtml(text)}</h2>` });
const sub = (text: string): Block => ({ h: 40, html: `<h3>${escapeHtml(text)}</h3>` });
const para = (text: string): Block => ({ h: lines(text, 100) * 17 + 10, html: `<p class="txt">${escapeHtml(text).replace(/\n/g, "<br />")}</p>` });
const bullets = (items: string[]): Block => ({ h: items.reduce((n, item) => n + lines(item, 96) * 17 + 5, 0) + 8, html: `<ul class="txt">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` });
/** A heading that always stays with the block after it. */
const together = (head: Block, next: Block): Block => ({ h: head.h + next.h, html: head.html + next.html });

function metricTable(rows: { label: string; value: string }[]): Block {
  const body: string[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i]!;
    const b = rows[i + 1];
    body.push(`<tr><td>${escapeHtml(a.label)}</td><td>${escapeHtml(a.value)}</td><td>${b ? escapeHtml(b.label) : ""}</td><td>${b ? escapeHtml(b.value) : ""}</td></tr>`);
  }
  return { h: 30 + body.length * ROW + 14, html: `<table class="grid four"><thead><tr><th>Metric</th><th>Result</th><th>Metric</th><th>Result</th></tr></thead><tbody>${body.join("")}</tbody></table>` };
}
function twoColumnTable(head: [string, string], rows: [string, string][], wide = false): Block {
  return { h: 30 + rows.length * ROW + 14, html: `<table class="grid two${wide ? " wide" : ""}"><thead><tr><th>${escapeHtml(head[0])}</th><th>${escapeHtml(head[1])}</th></tr></thead><tbody>${rows.map(([a, b]) => `<tr><td>${escapeHtml(a)}</td><td>${escapeHtml(b)}</td></tr>`).join("")}</tbody></table>` };
}

/** Screenshots in rows: one big, two side by side, or three across. */
function evidenceRows(shots: { img: Img; caption: string }[]): Block[] {
  const per = shots.length === 1 ? 1 : shots.length === 2 ? 2 : 3;
  const gap = 14;
  const cellW = Math.floor((CONTENT_W - gap * (per - 1) - 2) / per);
  const cellH = per === 1 ? 380 : per === 2 ? 250 : 176;
  const out: Block[] = [];
  for (let i = 0; i < shots.length; i += per) {
    const row = shots.slice(i, i + per);
    const caption = row.some((s) => s.caption);
    const cells = row.map(({ img, caption: text }) => {
      const [w, h] = fit(img, cellW - 12, cellH - 12);
      return `<figure style="width:${cellW}px"><div class="shot" style="height:${cellH}px"><img src="${img.src}" width="${w}" height="${h}" alt="" /></div>${caption ? `<figcaption>${escapeHtml(text)}</figcaption>` : ""}</figure>`;
    }).join("");
    out.push({ h: cellH + (caption ? 20 : 0) + 18, html: `<div class="evidence" style="gap:${gap}px">${cells}</div>` });
  }
  return out;
}

/* ---------- pages ---------- */

function footer(page: number, total: number): string {
  return `<footer class="foot"><span>Prepared by NeonLabz (Pvt) Ltd</span><span>Page ${page} of ${total}</span></footer>`;
}

export async function marketingReportHtml(report: ReportDocInput, assets: Assets, clientLogoUrl = ""): Promise<string> {
  const data = (key: string): PlatformData => ({ ...emptyPlatform(), ...(report.platforms?.[key] ?? {}) } as PlatformData);
  const used = REPORT_PLATFORMS.filter(([key]) => platformHasData(data(key)));
  const labels = used.map(([, label]) => label);
  const title = (report.title || "Social Media Completion Report").toUpperCase();

  // Pictures first, all at once.
  const metaShots = (report.metaShots ?? []).filter((s) => s.url);
  const [clientLogo, ...shotImages] = await Promise.all([
    embed(clientLogoUrl),
    ...used.flatMap(([key]) => data(key).shots.map((s) => embed(s.url))),
    ...metaShots.map((s) => embed(s.url)),
  ]);
  const shotsOf = new Map<string, { img: Img; caption: string }[]>();
  let at = 0;
  for (const [key] of used) {
    const list: { img: Img; caption: string }[] = [];
    for (const shot of data(key).shots) {
      const img = shotImages[at++];
      if (img) list.push({ img, caption: shot.caption });
    }
    shotsOf.set(key, list);
  }
  const metaList: { img: Img; caption: string }[] = [];
  for (const shot of metaShots) {
    const img = shotImages[at++];
    if (img) metaList.push({ img, caption: shot.caption });
  }

  // Sections: Facebook and Instagram share one, as Meta shows them together; every other platform has its own.
  const keys = used.map(([key]) => key);
  const groups: string[][] = [];
  const meta: string[] = keys.filter((k) => k === "facebook" || k === "instagram");
  if (meta.length) groups.push(meta);
  for (const key of keys) if (!meta.includes(key)) groups.push([key]);

  const sections: Block[][] = [];
  const labelOf = (key: string) => REPORT_PLATFORMS.find(([k]) => k === key)![1];
  groups.forEach((group, index) => {
    const blocks: Block[] = [secTitle(index + 1, `${listOf(group.map(labelOf))} Performance`)];
    for (const key of group) {
      const d = data(key);
      const label = labelOf(key);
      if (group.length > 1) blocks.push(sub(`${label} performance`));
      if (d.intro.trim()) blocks.push(para(d.intro.trim()));
      const metrics = d.metrics.filter((m) => m.label.trim() && m.value.trim());
      if (metrics.length) blocks.push(metricTable(metrics));
      if (d.analysis.trim()) blocks.push(para(d.analysis.trim()));
      const posts = d.posts.filter((p) => p.title.trim());
      if (posts.length) blocks.push(together(sub(`Top-performing ${label} posts`), twoColumnTable(["Content (as shown on the platform)", "Views"], posts.map((p) => [p.title, p.views || "—"]))));
      const rows = evidenceRows(shotsOf.get(key) ?? []);
      if (rows.length) blocks.push(together(sub(`${label} analytics evidence`), rows[0]!), ...rows.slice(1));
    }
    sections.push(blocks);
  });

  // Meta ads performance & summary: one line, then the screenshots.
  const metaSummary = (report.metaSummary ?? "").trim();
  if (metaSummary || metaList.length) {
    const blocks: Block[] = [secTitle(sections.length + 1, "Meta Ads Performance & Summary")];
    if (metaSummary) blocks.push(para(metaSummary));
    const rows = evidenceRows(metaList);
    if (rows.length) blocks.push(together(sub("Meta ads analytics evidence"), rows[0]!), ...rows.slice(1));
    sections.push(blocks);
  }

  // Last section: audience tables and the closing summary.
  const closing: Block[] = [];
  const audienceKeys = keys.filter((key) => data(key).audience.some((a) => a.label.trim() && a.value.trim()));
  closing.push(secTitle(sections.length + 1, audienceKeys.length ? "Audience Insights & Completion Summary" : "Completion Summary"));
  for (const key of audienceKeys) {
    const rows = data(key).audience.filter((a) => a.label.trim() && a.value.trim()).map((a): [string, string] => [a.label, a.value]);
    closing.push(together(sub(`${labelOf(key)} audience`), twoColumnTable(["Audience metric", "Result shown"], rows, true)));
  }
  if (report.clientSummary.trim()) closing.push(together(sub("Overall completion summary"), para(report.clientSummary.trim())));
  const actions = report.nextActions.map((a) => a.trim()).filter(Boolean);
  if (actions.length) closing.push(together(sub("Next actions"), bullets(actions)));
  if (report.contentDirection?.trim()) closing.push(together(sub("Content direction"), para(report.contentDirection.trim())));
  sections.push(closing);

  // Cut every section into pages; a section always starts on a fresh page.
  const pages: string[] = [];
  for (const blocks of sections) {
    let html = "";
    let filled = 0;
    for (const block of blocks) {
      if (filled + block.h > CAPACITY && html) { pages.push(html); html = ""; filled = 0; }
      html += block.html;
      filled += block.h;
    }
    if (html) pages.push(html);
  }

  const total = pages.length + 1;
  const logoBox = clientLogo ? fit(clientLogo, 420, 260) : null;
  const smallLogo = clientLogo ? fit(clientLogo, 150, 70) : null;
  const cover = `
    <section class="page cover">
      <div class="cover-top">${clientLogo && smallLogo ? `<img src="${clientLogo.src}" width="${smallLogo[0]}" height="${smallLogo[1]}" alt="" />` : "<span></span>"}<img src="${assets.logo}" class="brand" alt="NeonLabz" /></div>
      <div class="cover-mid">
        ${clientLogo && logoBox ? `<img src="${clientLogo.src}" width="${logoBox[0]}" height="${logoBox[1]}" alt="" class="hero" />` : ""}
        <h1>${escapeHtml(report.clientName.toUpperCase())}</h1>
        <h2>${escapeHtml(title)}</h2>
        <div class="bar"></div>
        ${labels.length ? `<p>${escapeHtml(labels.join(" • "))}</p>` : ""}
        <p>Reporting period: ${escapeHtml(period(report.startDate, report.endDate))}</p>
      </div>
      <div class="cover-by"><p>Prepared by</p><strong>NeonLabz (Pvt) Ltd</strong><p>Social Media Management &amp; Digital Marketing</p></div>
    </section>`;

  const body = pages.map((html, i) => `<section class="page">${html}${footer(i + 2, total)}</section>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(`${report.clientName} ${report.title || "Report"}`.trim())}</title>
<style>
  ${assets.font}
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #0b1020; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; box-sizing: border-box; }
  body { font: 12px/1.4 "NL Sans", Arial, sans-serif; color: #1A1F36; }
  .sheet { width: 794px; margin: 0 auto; background: #fff; }
  .page { position: relative; width: 794px; height: ${PAGE_H}px; padding: 52px ${SIDE}px 0; overflow: hidden; background: #fff; border-top: 5px solid #873CFF; break-after: page; }
  .page:last-child { break-after: auto; }
  h2.sec { margin: 0 0 16px; height: 36px; font-size: 25px; line-height: 36px; letter-spacing: -.01em; color: #0B1026; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  h3 { margin: 0; padding-top: 14px; height: 40px; font-size: 15px; line-height: 22px; color: #0B1026; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .txt { margin: 0 0 10px; font-size: 11.5px; line-height: 17px; color: #374151; }
  ul.txt { padding: 0; list-style: none; margin-bottom: 8px; }
  ul.txt li { position: relative; padding-left: 16px; margin-bottom: 5px; }
  ul.txt li::before { content: ""; position: absolute; left: 3px; top: 6px; width: 5px; height: 5px; border-radius: 50%; background: #873CFF; }
  table.grid { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 14px; border: 1px solid #E5E7EB; }
  .grid th { height: 30px; line-height: 30px; padding: 0 12px; background: #0B1026; color: #fff; font-size: 11.5px; font-weight: 700; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .grid td { height: ${ROW}px; line-height: ${ROW - 1}px; padding: 0 12px; font-size: 11.5px; color: #1A1F36; border-top: 1px solid #E5E7EB; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .grid tbody tr:nth-child(even) td { background: #F5F2FF; }
  .four th:nth-child(1), .four td:nth-child(1), .four th:nth-child(3), .four td:nth-child(3) { width: 29%; }
  .four th:nth-child(2), .four td:nth-child(2), .four th:nth-child(4), .four td:nth-child(4) { width: 21%; font-weight: 600; }
  .two th:nth-child(1), .two td:nth-child(1) { width: 78%; }
  .two th:nth-child(2), .two td:nth-child(2) { width: 22%; font-weight: 600; }
  .two.wide th:nth-child(1), .two.wide td:nth-child(1) { width: 34%; }
  .two.wide th:nth-child(2), .two.wide td:nth-child(2) { width: 66%; }
  .evidence { display: flex; align-items: flex-start; margin-bottom: 18px; }
  .evidence figure { margin: 0; flex: none; }
  .shot { display: flex; align-items: center; justify-content: center; border: 1px solid #E5E7EB; border-radius: 8px; background: #F8FAFC; overflow: hidden; }
  .shot img { display: block; }
  figcaption { height: 20px; padding-top: 4px; font-size: 10px; color: #6B7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foot { position: absolute; left: ${SIDE}px; right: ${SIDE}px; bottom: 22px; display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #6B7280; }
  .cover { display: flex; flex-direction: column; padding-top: 40px; }
  .cover-top { display: flex; justify-content: space-between; align-items: center; }
  .cover-top img { display: block; }
  .cover-top .brand { height: 30px; width: auto; }
  .cover-mid { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .cover-mid .hero { display: block; margin-bottom: 44px; }
  .cover-mid h1 { margin: 0; font-size: 34px; line-height: 1.15; letter-spacing: .01em; color: #0B1026; font-weight: 800; }
  .cover-mid h2 { margin: 10px 0 0; font-size: 18px; letter-spacing: .02em; color: #5B21E6; font-weight: 700; }
  .cover-mid .bar { width: 72px; height: 4px; margin: 22px 0 20px; border-radius: 4px; background: #873CFF; }
  .cover-mid p { margin: 0 0 8px; font-size: 12.5px; color: #4B5568; }
  .cover-by { padding-bottom: 80px; text-align: center; }
  .cover-by p { margin: 0 0 6px; font-size: 12px; color: #6B7280; }
  .cover-by strong { display: block; margin: 0 0 22px; font-size: 14px; color: #0B1026; }
  @media print { html, body { background: #fff !important; } }
</style></head>
<body><article class="sheet">${cover}${body}</article></body></html>`;
}
