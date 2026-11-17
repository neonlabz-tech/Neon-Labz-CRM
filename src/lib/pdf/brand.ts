import { escapeHtml } from "./letterhead";

type BrandLine = { name: string; detail: string; qty: string; rate: string; amount: string };
export type BrandModel = {
  variant: "invoice" | "package"; title: string; subtitle: string; preparedName: string; preparedNote: string;
  documentId: string; documentDate: string; documentMeta: string; lines: BrandLine[]; scopeItems: string[]; featureItems: string[];
  investment: number; investmentLabel: string; investmentNote: string; pricingNote: string; pageLabel: string; approved: boolean;
};

function decodeEntities(value: unknown) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractScopeBullets(html: unknown): string[] {
  const raw = String(html || "");
  if (!raw.trim()) return [];
  const marked = raw
    .replace(/<\/(li|p|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n");
  return decodeEntities(marked.replace(/<[^>]+>/g, " "))
    .split(/\n+/)
    .map((line: string) => line.replace(/\s+/g, " ").trim().replace(/^[•·▪◦‣*–—-]+\s*/, ""))
    .filter((line: string) => line.length > 1);
}

export function money(value: unknown) {
  const number = Number(value) || 0;
  return number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function padCount(value: unknown) {
  return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
}

export function docDate(iso?: string) {
  const [year, month, day] = String(iso || "").split("-");
  if (!year || !month || !day) return String(iso || "—");
  return `${day}/${month}/${year}`;
}

function paymentSeal(): string {
  return `<svg class="seal" viewBox="0 0 280 280" role="img" aria-label="Payment approved" xmlns="http://www.w3.org/2000/svg"><g transform="translate(140 140) rotate(-18)"><circle r="124" fill="#fff" stroke="#16a34a" stroke-width="14"/><circle r="104" fill="none" stroke="#16a34a" stroke-width="6"/><g fill="#16a34a" font-family="NL Sans, Arial, sans-serif" font-weight="800" font-size="26" text-anchor="middle" dominant-baseline="central"><text y="-14">PAYMENT</text><text y="18">APPROVED</text></g></g></svg>`;
}

function lineRows(lines: BrandLine[]) {
  if (!lines.length) {
    return `<tr><td colspan="4" class="empty-line">No package lines on this document.</td></tr>`;
  }
  return lines.map((line: BrandLine) => `
    <tr>
      <td>
        <strong>${escapeHtml(line.name || "Service")}</strong>
        ${line.detail ? `<span>${escapeHtml(line.detail)}</span>` : ""}
      </td>
      <td>${escapeHtml(line.qty || "01")}</td>
      <td>${escapeHtml(line.rate || money(0))}</td>
      <td>${escapeHtml(line.amount || money(0))}</td>
    </tr>
  `).join("");
}

export function renderBrandDocument({
  variant = "invoice",
  title = "Invoice.",
  subtitle = "",
  preparedName = "Client / Company Name",
  preparedNote = "Client details from NeonLabz CRM",
  documentId = "INV-XXXX",
  documentDate = "",
  documentMeta = "Project / Per project",
  lines = [],
  scopeItems = [],
  featureItems = [],
  investment = 0,
  investmentLabel = "Package investment",
  investmentNote = "Payment terms to be confirmed",
  pricingNote = "Scope and pricing are indicative until a formal quotation is issued.",
  pageLabel = "01 / 01",
  approved = false,
}: Partial<BrandModel>, logo: string, font: string): string {
  const invoice = variant === "invoice";
  const all = [...scopeItems, ...featureItems];
  const stamp = invoice && approved ? paymentSeal() : "";
  const notice = invoice && approved
    ? "PAYMENT APPROVED — ISSUED INVOICE"
    : invoice ? "DESIGN PREVIEW — NOT AN ISSUED INVOICE" : "SERVICE PACKAGE — NOT AN INVOICE";
  const eyebrow = invoice ? "SERVICE PACKAGE / INVOICE" : "SERVICE PACKAGE / OVERVIEW";
  const date = (documentDate || "DD/MM/YYYY").replace(/\//g, " / ");
  const twoColumns = all.length > 8;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
  ${font}
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #0b1020; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; box-sizing: border-box; }
  body { font: 13px/1.45 "NL Sans", Arial, sans-serif; color: #1B1E3C; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 24px; background: #fff; overflow: hidden; position: relative; box-shadow: 0 18px 48px rgba(7,12,43,.28); display: flex; flex-direction: column; }
  .strip { position: absolute; left: 0; top: 0; bottom: 0; width: 64px; background: #E9EAF8; }
  .main { position: relative; flex: 1; padding: 34px 62px 0 90px; display: flex; flex-direction: column; }
  .brand img { height: 28px; width: auto; display: block; }
  .tagline { margin: 20px 0 0; text-align: right; color: #6B7280; font-size: 11px; }
  .node { position: relative; margin-bottom: 26px; }
  .node::after { content: ""; position: absolute; left: -62px; top: 5px; width: 11px; height: 11px; border-radius: 50%; background: #5B52D6; z-index: 2; }
  .node:not(.last)::before { content: ""; position: absolute; left: -57px; top: 10px; height: calc(100% + 26px); width: 2px; background: #5B52D6; z-index: 1; }
  .first { margin-top: 26px; padding-bottom: 14px; border-bottom: 2px solid #5B52D6; }
  .kicker { margin: 0 0 10px; color: #5B52D6; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0 0 6px; font-size: 52px; line-height: 1; letter-spacing: -.035em; color: #1B1E3C; font-weight: 800; }
  .sub { margin: 0; color: #5B6275; font-size: 13px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 16px 0 18px; border-bottom: 1px solid #E5E7EB; }
  p.label, .meta p.label { margin: 0 0 6px; color: #5B52D6; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .meta strong { display: block; font-size: 16px; color: #1B1E3C; }
  .meta p { margin: 4px 0 0; color: #6B7280; font-size: 11.5px; }
  .meta p.label, .note p.label { margin: 0 0 6px; color: #5B52D6; font-size: 10px; }
  .head-row { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 12px; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .head-row span:first-child { color: #5B52D6; } .head-row span:last-child { color: #6B7280; }
  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 9px; }
  ul.two { grid-template-columns: 1fr 1fr; gap: 9px 28px; }
  li { position: relative; padding-left: 20px; color: #1F2937; font-size: 12px; font-weight: 500; }
  li::before { content: ""; position: absolute; left: 2px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: #5B52D6; }
  table { width: 100%; border-collapse: collapse; border-top: 3px solid #5B52D6; }
  th { padding: 11px 12px; text-align: left; color: #6B7280; font-size: 9.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  td { padding: 14px 12px; vertical-align: top; border-top: 1px solid #E5E7EB; }
  th:nth-child(n+2), td:nth-child(n+2) { text-align: right; white-space: nowrap; }
  td:last-child { font-weight: 700; color: #1B1E3C; }
  td strong { display: block; color: #1B1E3C; font-size: 15px; font-weight: 700; }
  td span { display: block; margin-top: 3px; color: #6B7280; font-size: 11px; }
  .empty-line { color: #9CA3AF; }
  .bottom { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
  .note { max-width: 290px; color: #5B6275; font-size: 11.5px; }
  .note p { margin: 0; }
  .invest { min-width: 270px; background: #5B52D6; color: #fff; border-radius: 8px; padding: 18px 24px; text-align: center; }
  .invest small { display: block; letter-spacing: .08em; text-transform: uppercase; font-size: 10px; font-weight: 700; }
  .invest b { display: block; margin: 6px 0 6px; font-size: 30px; letter-spacing: -.02em; font-weight: 800; }
  .invest em { display: block; font-style: normal; font-size: 11px; line-height: 1.5; opacity: .9; }
  .grow { flex: 1; min-height: 12px; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; padding: 14px 0 22px; border-top: 1px solid #E5E7EB; color: #4B5568; font-size: 11px; }
  .foot strong { display: block; color: #1B1E3C; letter-spacing: .04em; }
  .foot .right { text-align: right; }
  .page { display: block; margin-top: 4px; color: #9CA3AF; letter-spacing: .08em; }
  .seal { position: absolute; right: 62px; top: 96px; width: 108px; height: 108px; z-index: 3; overflow: visible; }
  @media print {
    html, body { background: #fff !important; }
    .sheet { margin: 0 !important; box-shadow: none !important; width: 210mm; min-height: 0 !important; }
  }
</style></head>
<body>
  <article class="sheet">
    <div class="strip"></div>
    <div class="main">
      ${stamp}
      <div class="brand"><img src="${logo}" alt="NeonLabz" /></div>
      <p class="tagline">Turning Ideas into Digital Reality</p>
      <section class="node first">
        <p class="kicker">${eyebrow}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="sub">${escapeHtml(subtitle)}</p>
      </section>
      <section class="node meta">
        <article>
          <p class="label">Prepared for</p>
          <strong>${escapeHtml(preparedName)}</strong>
          <p>${escapeHtml(preparedNote)}</p>
        </article>
        <article>
          <p class="label">Document information</p>
          <strong>${escapeHtml(documentId)} | ${escapeHtml(date)}</strong>
          <p>${escapeHtml(documentMeta)}</p>
        </article>
      </section>
      ${all.length ? `<section class="node">
        <div class="head-row"><span>01 / Approved package scope</span><span>${padCount(all.length)} included features</span></div>
        <ul${twoColumns ? ' class="two"' : ""}>${all.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>` : ""}
      <section class="node">
        <div class="head-row"><span>${all.length ? "02" : "01"} / Service &amp; investment</span><span></span></div>
        <table>
          <thead>
            <tr><th>Package / Description</th><th>Qty</th><th>Rate (LKR)</th><th>Amount (LKR)</th></tr>
          </thead>
          <tbody>${lineRows(lines)}</tbody>
        </table>
      </section>
      <section class="node last bottom">
        <div class="note">
          <p class="label">Pricing note</p>
          <p>${escapeHtml(pricingNote)}</p>
        </div>
        <div class="invest">
          <small>${escapeHtml(investmentLabel)}</small>
          <b>LKR ${escapeHtml(money(investment))}</b>
          <em>${escapeHtml(investmentNote).replace(/\n/g, "<br />")}</em>
        </div>
      </section>
      <div class="grow"></div>
      <footer class="foot">
        <div>
          <strong>NEON LABZ</strong>
          Software &amp; Digital Solutions<br />
          ${escapeHtml(notice)}
        </div>
        <div class="right">
          www.theneonlabz.com &nbsp;|&nbsp; info@theneonlabz.com<br />
          +94 71 431 2534
          <span class="page">${escapeHtml(pageLabel)}</span>
        </div>
      </footer>
    </div>
  </article>
</body></html>`;
}
