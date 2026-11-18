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

function bulletList(items: string[]) {
  if (!items.length) return `<p class="empty-line">Scope will be confirmed with the client.</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
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
  const theme = invoice ? "is-invoice" : "is-package";
  const features = featureItems.length ? featureItems : scopeItems.slice(Math.ceil(scopeItems.length / 2));
  const scope = featureItems.length ? scopeItems : scopeItems.slice(0, Math.ceil(scopeItems.length / 2) || scopeItems.length);
  const featureCount = padCount(scopeItems.length || (scope.length + features.length));
  const stamp = invoice && approved ? paymentSeal() : "";
  const notice = invoice && approved
    ? "PAYMENT APPROVED — ISSUED INVOICE"
    : "DESIGN PREVIEW — NOT AN ISSUED INVOICE";
  const eyebrow = "SERVICE PACKAGE / INVOICE PREVIEW";
  const headerAside = invoice
    ? `<p>Turning Ideas into Digital Reality</p>`
    : `<p>CRM / SERVICE DOCUMENT</p>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
  ${font}
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #0b1020; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { font: 13.5px/1.45 "NL Sans", Arial, sans-serif; color: #111827; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 24px; background: #fff; box-sizing: border-box; overflow: hidden; position: relative; box-shadow: 0 18px 48px rgba(7,12,43,.28); }
  .sheet::before { content: ""; display: block; height: 5px; background: #873CFF; }
  .head { display: flex; justify-content: space-between; align-items: center; padding: 18px 40px; min-height: 84px; box-sizing: border-box; background: #0B1026; }
  .brand { display: flex; align-items: center; }
  .brand img { height: 36px; width: auto; display: block; }
  .head-copy { text-align: right; font-size: 11px; color: #D1D5DB; line-height: 1.45; }
  .head-copy p { margin: 0; }
  .rule { height: 2px; background: #C412FC; }
  .pad { padding: 28px 40px 18px; }
  .kicker { margin: 0 0 10px; color: #873CFF; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  h1 { margin: 0 0 8px; font-size: 44px; line-height: .95; letter-spacing: -.04em; color: #0B1026; font-weight: 800; }
  .sub { margin: 0 0 28px; color: #4B5568; font-size: 15px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin: 0 0 28px; }
  .meta .label, .block-label { margin: 0 0 6px; color: #873CFF; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  .meta strong { display: block; font-size: 18px; color: #0B1026; }
  .meta p { margin: 4px 0 0; color: #6B7280; }
  .section { margin: 0 0 22px; }
  .section-head { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 10px; color: #873CFF; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 12px 14px; }
  th { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
  td:nth-child(2), td:nth-child(3), td:nth-child(4), th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; white-space: nowrap; }
  td strong { display: block; color: #0B1026; font-size: 15px; }
  td span { display: block; margin-top: 3px; color: #6B7280; }
  .empty-line { color: #9CA3AF; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 22px 28px; }
  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
  li { position: relative; padding: 2px 0 2px 22px; color: #1F2937; }
  li::before { content: ""; position: absolute; left: 0; top: 8px; width: 8px; height: 8px; background: #873CFF; border-radius: 50%; }
  .bottom { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-top: 8px; }
  .note { max-width: 280px; color: #6B7280; }
  .note .label { margin-bottom: 6px; color: #873CFF; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  .note p { margin: 0; }
  .invest { min-width: 240px; background: #873CFF; color: #fff; border-radius: 16px; padding: 18px 22px; text-align: right; }
  .invest small { display: block; letter-spacing: .14em; text-transform: uppercase; font-size: 10px; opacity: .72; }
  .invest b { display: block; margin: 6px 0 4px; font-size: 28px; letter-spacing: -.03em; }
  .invest em { display: block; font-style: normal; font-size: 11px; opacity: .7; }
  .foot { display: flex; justify-content: space-between; gap: 18px; padding: 18px 40px 22px; color: #4B5568; font-size: 11px; }
  .foot strong { display: block; color: #0B1026; letter-spacing: .08em; }
  .foot .right { text-align: right; }
  .page { display: block; margin-top: 8px; color: #9CA3AF; letter-spacing: .08em; }
  .seal { position: absolute; right: 42px; top: 104px; width: 108px; height: 108px; z-index: 3; overflow: visible; }
  .is-invoice .head { background: #0B1026; }
  .is-invoice .head-copy { color: #D1D5DB; }
  .is-invoice .meta article { padding: 0 18px 0 0; }
  .is-invoice .meta article + article { border-left: 1px solid #E5E7EB; padding-left: 28px; }
  .is-invoice th { background: #F3F5FA; color: #6B7280; }
  .is-invoice td { border-bottom: 1px solid #EEF0F5; }
  .is-invoice td:last-child { font-weight: 700; }
  .is-package .head { background: #0B1026; color: #D1D5DB; }
  .is-package .head-copy { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-style: normal; color: #D1D5DB; }
  .is-package .meta { background: #F7F8FC; border-radius: 16px; overflow: hidden; }
  .is-package .meta article { padding: 16px 18px; }
  .is-package .meta article + article { border-left: 1px solid #E4E7F1; }
  .is-package th { background: #F3F5FA; color: #6B7280; }
  .is-package td { border-bottom: 1px solid #F3F5FA; }
  .is-package li { background: #F7F8FC; border-radius: 10px; padding: 8px 10px 8px 28px; }
  .is-package li::before { left: 10px; top: 13px; }
  @media print {
    html, body { background: #fff !important; }
    .sheet { margin: 0 !important; box-shadow: none !important; width: 210mm; min-height: 0 !important; }
  }
</style></head>
<body>
  <article class="sheet ${theme}">
    <header class="head">
      <div class="brand"><img src="${logo}" alt="NeonLabz" /></div>
      <div class="head-copy">${headerAside}</div>
    </header>
    <div class="rule"></div>
    <div class="pad">
      ${stamp}
      <p class="kicker">${eyebrow}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="sub">${escapeHtml(subtitle)}</p>
      ${invoice ? `<div class="meta">
        <article>
          <p class="label">Prepared for</p>
          <strong>${escapeHtml(preparedName)}</strong>
          <p>${escapeHtml(preparedNote)}</p>
        </article>
        <article>
          <p class="label">Document information</p>
          <strong>${escapeHtml(documentId)} | ${escapeHtml(documentDate || "DD/MM/YYYY")}</strong>
          <p>${escapeHtml(documentMeta)}</p>
        </article>
      </div>` : ""}
      <section class="section">
        <div class="section-head"><span>01 / Service &amp; investment</span></div>
        <table>
          <thead>
            <tr>
              <th>Package / Description</th>
              <th>Qty</th>
              <th>Rate (LKR)</th>
              <th>Amount (LKR)</th>
            </tr>
          </thead>
          <tbody>${lineRows(lines)}</tbody>
        </table>
      </section>
      ${scope.length || features.length ? `      <section class="section">
        <div class="section-head">
          <span>02 / Approved package scope</span>
          <span>${featureCount} included features</span>
        </div>
        <div class="split">
          <div>${bulletList(scope)}</div>
          <div>${bulletList(features)}</div>
        </div>
      </section>` : ""}
      <div class="bottom">
        <div class="note">
          <div class="label">Pricing note</div>
          <p>${escapeHtml(pricingNote)}</p>
        </div>
        <div class="invest">
          <small>${escapeHtml(investmentLabel)}</small>
          <b>LKR ${escapeHtml(money(investment))}</b>
          <em>${escapeHtml(investmentNote).replace(/\n/g, "<br />")}</em>
        </div>
      </div>
    </div>
    <footer class="foot">
      <div>
        <strong>NEON LABZ</strong>
        Software &amp; Digital Solutions<br />
        ${escapeHtml(notice)}
      </div>
      <div class="right">
        www.theneonlabz.com &nbsp;|&nbsp; theneonlabz@gmail.com<br />
        +94 71 431 2534
        <span class="page">${escapeHtml(pageLabel)}</span>
      </div>
    </footer>
  </article>
</body></html>`;
}

