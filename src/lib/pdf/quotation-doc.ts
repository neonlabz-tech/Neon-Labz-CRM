import { docDate, extractScopeBullets, money } from "./brand";
import { escapeHtml } from "./letterhead";
import { cleanRich } from "../rich-text";
import { iconPaths, svgIcon, UI_ICONS } from "../package-icons";

/** Company details printed on every quotation. Change them here. */
const COMPANY = {
  address: "Ramanathan Road, Jaffna, Sri Lanka",
  email: "info@theneonlabz.com",
  phone: "+94 71 431 2534",
  web: "www.theneonlabz.com",
};

export type QuotationModel = {
  number: string; client: string; address: string; email: string; phone: string; date: string; valid: string;
  items: { name: string; sub: string; icon: string; scopeHtml: string; price: number }[];
  subtotal: number; discountPercent: number; discount: number; total: number; terms: string;
};

const PURPLE = "#873CFF";
const ui = (name: keyof typeof UI_ICONS, size = 14, color = PURPLE) => svgIcon(UI_ICONS[name], size, color);
/** Formatted text (lists, tables, bold, colour) is shown as written. Plain lines keep the old bullet look. */
const FORMATTED = /<(ul|ol|li|table|h[1-4]|b|strong|i|em|u|span|a|blockquote|code|sub|sup)\b|<[^>]+\sstyle=/i;
const formatted = (html: string) => FORMATTED.test(html);
const dotted = (iso: string) => docDate(iso).replace(/\//g, ".");

function requirement(names: string[]): string {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}

/** The client-facing quotation: letterhead, who it is for, a table of services with an icon and bullet scope, totals, validity and notes. */
export function renderQuotationDocument(model: QuotationModel, logo: string, font: string): string {
  const rows = model.items.map((item, index) => {
    const bullets = extractScopeBullets(item.scopeHtml);
    const reduced = item.price * (1 - model.discountPercent / 100);
    const unitPrice = model.discountPercent > 0
      ? `<span class="old-price">${escapeHtml(money(item.price))}</span><strong>${escapeHtml(money(reduced))}</strong>`
      : escapeHtml(money(item.price));
    return `
        <tr>
          <td class="c">${index + 1}</td>
          <td><div class="svc"><span class="tile">${svgIcon(iconPaths(item.icon), 26, PURPLE, 1.8)}</span><span><strong>${escapeHtml(item.name)}</strong>${item.sub ? `<em>${escapeHtml(item.sub)}</em>` : ""}</span></div></td>
          <td>${formatted(item.scopeHtml) ? `<div class="rt">${cleanRich(item.scopeHtml)}</div>` : bullets.length ? `<ul class="scope">${bullets.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}</td>
          <td class="c">1</td>
          <td class="r">${unitPrice}</td>
          <td class="r b">${model.discountPercent > 0 ? escapeHtml(money(reduced)) : escapeHtml(money(item.price))}</td>
        </tr>`;
  }).join("");
  const termsFormatted = formatted(model.terms);
  const notes = termsFormatted ? [] : model.terms.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const valid = model.valid ? dotted(model.valid) : "";
  const need = requirement(model.items.map((item) => item.name));
  const details = [
    ["Client", model.client || "Client"],
    ["Phone", model.phone],
    ["Email", model.email],
    ["Address", model.address],
  ].filter(([, value]) => value);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(model.number || "Quotation")}</title>
<style>
  ${font}
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #0b1020; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; box-sizing: border-box; }
  body { font: 12px/1.45 "NL Sans", Arial, sans-serif; color: #1A1F36; }
  .sheet { display: flex; flex-direction: column; width: 210mm; min-height: 297mm; margin: 0 auto 24px; background: #fff; position: relative; box-shadow: 0 18px 48px rgba(7,12,43,.28); }
  .top { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 26px 40px 18px; }
  .top img { height: 34px; width: auto; display: block; }
  .right { display: flex; align-items: center; gap: 18px; }
  .contact { display: grid; gap: 5px; font-size: 10.5px; color: #374151; }
  .contact p { display: flex; align-items: center; gap: 8px; margin: 0; }
  .contact svg, .foot svg { flex: none; display: block; }
  .qmeta { border-left: 1px solid #E5E7EB; padding-left: 18px; min-width: 120px; }
  .qmeta small { display: block; font-size: 10px; color: #6B7280; }
  .qmeta b { display: block; margin: 1px 0 7px; font-size: 15px; letter-spacing: -.01em; color: #5B21E6; }
  .qmeta b.plain { color: #0B1026; font-size: 12.5px; margin-bottom: 0; }
  .rule { height: 2px; margin: 0 40px; background: linear-gradient(90deg, #873CFF, #C412FC); border-radius: 2px; opacity: .55; }
  .pad { padding: 20px 36px 6px; }
  .to { display: grid; grid-template-columns: 1fr 1.15fr; gap: 24px; align-items: center; margin-bottom: 20px; }
  .label { margin: 0 0 8px; color: #5B21E6; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  dl { margin: 0; display: grid; gap: 4px; }
  dl div { display: grid; grid-template-columns: 62px 12px 1fr; font-size: 12px; }
  dt { font-weight: 700; color: #0B1026; } dd { margin: 0; color: #374151; }
  .req { display: flex; align-items: center; gap: 14px; background: #F5F2FF; border-radius: 14px; padding: 16px 18px; }
  .req .tile { width: 44px; height: 44px; }
  .req b { display: block; color: #5B21E6; font-size: 11.5px; margin-bottom: 4px; }
  .req p { margin: 0; font-size: 12.5px; color: #1A1F36; }
  .tile { flex: none; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(145deg, #F4EEFF, #E7DBFF); border: 1px solid #E1D3FF; }
  .tile svg { display: block; }
  .tbl { border: 1px solid #E5E7EB; border-radius: 10px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: #0B1026; color: #fff; font-size: 10.5px; font-weight: 700; text-align: left; padding: 9px; border-left: 1px solid rgba(255,255,255,.12); }
  th:first-child { border-left: 0; }
  td { padding: 8px 9px; vertical-align: middle; border-top: 1px solid #E5E7EB; border-left: 1px solid #E5E7EB; }
  td:first-child { border-left: 0; }
  tr { break-inside: avoid; }
  .c { text-align: center; } .r { text-align: right; white-space: nowrap; } .b { font-weight: 800; color: #0B1026; }
  .old-price { display: block; color: #9CA3AF; font-size: 10px; text-decoration: line-through; }
  th.c { text-align: center; } th.r { text-align: right; }
  .svc { display: flex; align-items: center; gap: 10px; }
  .svc strong { display: block; font-size: 12.5px; line-height: 1.25; color: #0B1026; }
  .svc em { display: block; margin-top: 2px; font-style: normal; font-size: 10.5px; color: #6B7280; }
  .scope { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; font-size: 11px; color: #374151; }
  .scope li { position: relative; padding-left: 13px; }
  .scope li::before { content: ""; position: absolute; left: 1px; top: 6px; width: 4px; height: 4px; border-radius: 50%; background: #0B1026; }
  .rt { font-size: 11px; line-height: 1.45; color: #374151; overflow-wrap: anywhere; }
  .rt p, .rt div { margin: 0 0 3px; }
  .rt ul { margin: 2px 0 4px; padding-left: 18px; list-style: disc; }
  .rt ol { margin: 2px 0 4px; padding-left: 18px; list-style: decimal; }
  .rt li { margin: 1px 0; }
  .rt h1, .rt h2, .rt h3, .rt h4 { margin: 6px 0 3px; font-size: 12px; font-weight: 800; color: #0B1026; }
  .rt table { width: 100%; border-collapse: collapse; margin: 4px 0 6px; font-size: 10.5px; table-layout: auto; }
  .rt th, .rt td { border: 1px solid #D9DCEA; padding: 3px 6px; text-align: left; vertical-align: top; border-left: 1px solid #D9DCEA; }
  .rt th { background: #F3EFFF; color: #0B1026; font-weight: 700; }
  .rt tr { break-inside: avoid; }
  .notes .rt { font-size: 11.5px; }
  .sum { display: grid; grid-template-columns: 1fr 290px; gap: 20px; margin-top: 20px; break-inside: avoid; align-items: start; }
  .valid { display: flex; align-items: center; gap: 12px; background: #F5F2FF; border-radius: 14px; padding: 16px 18px; }
  .valid b { display: block; color: #5B21E6; font-size: 11.5px; letter-spacing: .04em; margin-bottom: 3px; }
  .valid p { margin: 0; font-size: 11.5px; color: #374151; }
  .totals { border: 1px solid #E5E7EB; border-radius: 10px; overflow: hidden; }
  .totals p { display: flex; justify-content: space-between; gap: 12px; margin: 0; padding: 9px 14px; font-size: 12px; border-top: 1px solid #EEF0F5; }
  .totals p:first-child { border-top: 0; }
  .totals p span:first-child { font-weight: 700; color: #0B1026; }
  .totals p span:last-child { font-weight: 800; color: #0B1026; }
  .totals .off span:last-child { color: #15803d; }
  .totals .grand { background: #EFE9FF; font-size: 13px; }
  .totals .grand span { color: #5B21E6 !important; font-size: 13.5px; }
  .notes { margin-top: 20px; break-inside: avoid; }
  .notes h3 { margin: 0 0 6px; color: #5B21E6; font-size: 12px; }
  .notes ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 11.5px; color: #374151; }
  .notes li { position: relative; padding-left: 16px; }
  .notes li::before { content: ""; position: absolute; left: 3px; top: 6px; width: 4px; height: 4px; border-radius: 50%; background: #0B1026; }
  .sheet > :nth-last-child(2) { margin-bottom: 10px; }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: auto 40px 0; padding: 14px 0 22px; border-top: 1px solid #E5E7EB; font-size: 10.5px; color: #374151; }
  .foot span { display: flex; align-items: center; gap: 7px; }
  .foot span + span { border-left: 1px solid #D1D5DB; padding-left: 12px; }
  @media print {
    html, body { background: #fff !important; }
    .sheet { margin: 0 !important; box-shadow: none !important; width: 210mm; min-height: 296mm !important; }
    .tbl { overflow: visible; }
    table { break-inside: auto; }
    tr { break-inside: avoid; break-after: auto; }
  }
</style></head>
<body>
  <article class="sheet">
    <header class="top">
      <img src="${logo}" alt="NeonLabz" />
      <div class="right">
        <div class="contact">
          <p>${ui("pin")}${escapeHtml(COMPANY.address)}</p>
          <p>${ui("mail")}${escapeHtml(COMPANY.email)}</p>
          <p>${ui("phone")}${escapeHtml(COMPANY.phone)}</p>
          <p>${ui("globe")}${escapeHtml(COMPANY.web)}</p>
        </div>
        <div class="qmeta">
          <small>Quotation No.</small><b>${escapeHtml(model.number)}</b>
          <small>Date</small><b class="plain">${escapeHtml(dotted(model.date))}</b>
        </div>
      </div>
    </header>
    <div class="rule"></div>
    <div class="pad">
      <section class="to">
        <div>
          <p class="label">Quotation for</p>
          <dl>${details.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dt>:</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
        </div>
        ${need ? `<div class="req"><span class="tile">${svgIcon(UI_ICONS.briefcase, 22, PURPLE, 1.8)}</span><div><b>Project / Requirement</b><p>${escapeHtml(need)}</p></div></div>` : "<div></div>"}
      </section>
      <div class="tbl">
        <table>
          <thead><tr><th class="c" style="width:28px">#</th><th style="width:155px">Service / Product</th><th>Description</th><th class="c" style="width:38px">Qty</th><th class="r" style="width:90px">Unit Price (LKR)</th><th class="r" style="width:90px">Total (LKR)</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <section class="sum">
        <div class="valid"><span class="tile">${svgIcon(UI_ICONS.file, 22, PURPLE, 1.8)}</span><div><b>VALIDITY</b><p>${valid ? `This quotation is valid until ${escapeHtml(valid)}.` : "This quotation is valid for 14 days from the date of issue."}</p></div></div>
        <div class="totals">
          <p><span>Total Qty</span><span>${model.items.length}</span></p>
          <p><span>Subtotal</span><span>LKR ${escapeHtml(money(model.subtotal))}</span></p>
          ${model.discount > 0 ? `<p class="off"><span>Discount (${escapeHtml(String(model.discountPercent))}%)</span><span>-LKR ${escapeHtml(money(model.discount))}</span></p>` : ""}
          <p class="grand"><span>Total Amount</span><span>LKR ${escapeHtml(money(model.total))}</span></p>
        </div>
      </section>
      ${termsFormatted ? `<section class="notes"><h3>Notes:</h3><div class="rt">${cleanRich(model.terms)}</div></section>` : ""}
      ${notes.length ? `<section class="notes"><h3>Notes:</h3><ul>${notes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul></section>` : ""}
    </div>
    <footer class="foot">
      <span>${ui("pin", 15)}${escapeHtml(COMPANY.address)}</span>
      <span>${ui("mail", 15)}${escapeHtml(COMPANY.email)}</span>
      <span>${ui("phone", 15)}${escapeHtml(COMPANY.phone)}</span>
      <span>${ui("globe", 15)}${escapeHtml(COMPANY.web)}</span>
    </footer>
  </article>
</body></html>`;
}
