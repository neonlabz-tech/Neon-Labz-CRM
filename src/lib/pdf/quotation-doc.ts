import { docDate, money } from "./brand";
import { escapeHtml } from "./letterhead";

export type QuotationModel = {
  number: string; client: string; address: string; contact: string; date: string; valid: string;
  items: { name: string; scopeHtml: string; price: number }[];
  subtotal: number; discountPercent: number; discount: number; total: number; terms: string;
};

/** The client-facing quotation: same look as the invoice, with the scope under each package, totals, terms and a place to accept. */
export function renderQuotationDocument(model: QuotationModel, logo: string, font: string): string {
  const rows = model.items.map((item, index) => `
        <tr>
          <td class="no">${String(index + 1).padStart(2, "0")}</td>
          <td><strong>${escapeHtml(item.name)}</strong>${item.scopeHtml.trim() ? `<div class="scope">${item.scopeHtml.replace(/(<li[^>]*>\s*(?:<[^>]+>\s*)*)[•·▪◦‣]\s*/gi, "$1")}</div>` : ""}</td>
          <td class="amt">${escapeHtml(money(item.price))}</td>
        </tr>`).join("");
  const terms = model.terms.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const valid = model.valid ? docDate(model.valid) : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(model.number || "Quotation")}</title>
<style>
  ${font}
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #0b1020; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; box-sizing: border-box; }
  body { font: 13px/1.5 "NL Sans", Arial, sans-serif; color: #111827; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 24px; background: #fff; overflow: hidden; position: relative; box-shadow: 0 18px 48px rgba(7,12,43,.28); display: flex; flex-direction: column; }
  .sheet::before { content: ""; display: block; height: 5px; background: #873CFF; }
  .head { display: flex; justify-content: space-between; align-items: center; padding: 18px 40px; min-height: 84px; background: #0B1026; }
  .head img { height: 36px; width: auto; display: block; }
  .head p { margin: 0; text-align: right; font-size: 11px; color: #D1D5DB; }
  .rule { height: 2px; background: #C412FC; }
  .pad { padding: 28px 40px 12px; flex: 1; }
  .kicker, .label { margin: 0 0 6px; color: #873CFF; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  h1 { margin: 0 0 24px; font-size: 44px; line-height: .95; letter-spacing: -.04em; color: #0B1026; font-weight: 800; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; margin: 0 0 26px; }
  .meta article { padding: 0 18px 0 0; }
  .meta article + article { border-left: 1px solid #E5E7EB; padding: 0 0 0 28px; }
  .meta strong { display: block; font-size: 18px; color: #0B1026; }
  .meta p { margin: 4px 0 0; color: #6B7280; }
  .section-head { margin: 0 0 10px; color: #873CFF; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #F3F5FA; color: #6B7280; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; text-align: left; padding: 10px 14px; }
  td { padding: 14px; vertical-align: top; border-bottom: 1px solid #EEF0F5; }
  tr { break-inside: avoid; }
  .no { width: 44px; color: #873CFF; font-weight: 700; }
  th.amt, td.amt { text-align: right; white-space: nowrap; width: 150px; }
  td.amt { font-weight: 700; color: #0B1026; }
  td strong { display: block; color: #0B1026; font-size: 15px; }
  .scope { margin-top: 8px; color: #4B5568; }
  .scope p, .scope div { margin: 0 0 4px; }
  .scope ul, .scope ol { margin: 0 0 4px; padding: 0; list-style: none; display: grid; gap: 4px; }
  .scope li { position: relative; padding-left: 18px; }
  .scope ul li::before { content: ""; position: absolute; left: 0; top: 7px; width: 7px; height: 7px; border-radius: 50%; background: #873CFF; }
  .scope ol { counter-reset: n; } .scope ol li { counter-increment: n; } .scope ol li::before { content: counter(n) "."; position: absolute; left: 0; color: #873CFF; font-weight: 700; }
  .totals { display: flex; justify-content: flex-end; margin: 18px 0 26px; break-inside: avoid; }
  .totals > div { width: 300px; }
  .totals p { display: flex; justify-content: space-between; gap: 12px; margin: 0 0 6px; padding: 0 4px; color: #4B5568; }
  .totals .off { color: #15803d; }
  .grand { margin-top: 10px; background: #0B1026; color: #fff; border-radius: 14px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
  .grand small { letter-spacing: .14em; text-transform: uppercase; font-size: 10px; opacity: .75; }
  .grand b { font-size: 22px; letter-spacing: -.02em; }
  .terms { margin: 0 0 26px; break-inside: avoid; }
  .terms ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; counter-reset: t; color: #374151; }
  .terms li { counter-increment: t; position: relative; padding-left: 26px; }
  .terms li::before { content: counter(t, decimal-leading-zero); position: absolute; left: 0; color: #873CFF; font-weight: 700; font-size: 11px; top: 1px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 30px; break-inside: avoid; }
  .sign div { border-top: 1px solid #9CA3AF; padding-top: 8px; color: #6B7280; font-size: 11px; }
  .sign b { display: block; color: #0B1026; font-size: 12px; }
  .foot { display: flex; justify-content: space-between; gap: 18px; padding: 16px 40px 20px; color: #4B5568; font-size: 11px; border-top: 1px solid #EEF0F5; }
  .foot strong { display: block; color: #0B1026; letter-spacing: .08em; }
  .foot .right { text-align: right; }
  @media print {
    html, body { background: #fff !important; }
    .sheet { margin: 0 !important; box-shadow: none !important; width: 210mm; min-height: 0 !important; }
  }
</style></head>
<body>
  <article class="sheet">
    <header class="head"><img src="${logo}" alt="NeonLabz" /><p>Turning Ideas into Digital Reality</p></header>
    <div class="rule"></div>
    <div class="pad">
      <p class="kicker">Proposal &amp; pricing</p>
      <h1>Quotation.</h1>
      <div class="meta">
        <article>
          <p class="label">Prepared for</p>
          <strong>${escapeHtml(model.client || "Client")}</strong>
          ${model.address ? `<p>${escapeHtml(model.address)}</p>` : ""}${model.contact ? `<p>${escapeHtml(model.contact)}</p>` : ""}
        </article>
        <article>
          <p class="label">Quotation details</p>
          <strong>${escapeHtml(model.number)} | ${escapeHtml(docDate(model.date))}</strong>
          <p>${valid ? `Valid until ${escapeHtml(valid)}` : "Prices in Sri Lankan Rupees (LKR)"}</p>
        </article>
      </div>
      <div class="section-head">01 / Services &amp; investment</div>
      <table>
        <thead><tr><th>No.</th><th>Package &amp; scope of work</th><th class="amt">Amount (LKR)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals"><div>
        <p><span>Subtotal</span><span>LKR ${escapeHtml(money(model.subtotal))}</span></p>
        ${model.discount > 0 ? `<p class="off"><span>Special discount (${escapeHtml(String(model.discountPercent))}%)</span><span>-LKR ${escapeHtml(money(model.discount))}</span></p>` : ""}
        <div class="grand"><small>Grand total</small><b>LKR ${escapeHtml(money(model.total))}</b></div>
      </div></div>
      ${terms.length ? `<section class="terms"><div class="section-head">02 / Terms &amp; conditions</div><ol>${terms.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol></section>` : ""}
      <div class="sign"><div><b>Accepted by (client)</b>Name, signature and date</div><div><b>For Neon Labz</b>Authorised signature and date</div></div>
    </div>
    <footer class="foot">
      <div><strong>NEON LABZ</strong>Software &amp; Digital Solutions<br />QUOTATION ${escapeHtml(model.number)}${valid ? ` · VALID UNTIL ${escapeHtml(valid)}` : ""}</div>
      <div class="right">www.theneonlabz.com &nbsp;|&nbsp; theneonlabz@gmail.com<br />+94 71 431 2534</div>
    </footer>
  </article>
</body></html>`;
}
