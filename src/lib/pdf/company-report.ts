import type { ReportData } from "@/lib/company-reports";
import { escapeHtml, wrapLetterhead } from "./letterhead";
import type { Assets } from "./documents";

const CSS = `
  .report-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 6px; }
  .report-cards div { background: #F1E8FF; border-radius: 10px; padding: 10px 12px; }
  .report-cards span { display: block; color: #69708A; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .report-cards strong { display: block; margin-top: 3px; font-size: 15px; color: #0B1026; }
  .doc-body td, .doc-body th { font-size: 11px; }
  .doc-body tr { break-inside: avoid; }
  .report-note { color: #69708A; font-size: 11px; margin: -6px 0 12px; }
`;

/** A finished A4 report: the figures at the top, then one table for each section. */
export function companyReportHtml(report: ReportData, period: string, assets: Assets): string {
  const cards = report.summary.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const sections = report.sections.map((section) => {
    const head = `<tr>${section.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;
    const body = section.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
    const table = section.rows.length ? `<table><thead>${head}</thead><tbody>${body}</tbody></table>` : "";
    return `<h2>${escapeHtml(section.heading)}</h2>${table}${section.note ? `<p class="report-note">${escapeHtml(section.note)}</p>` : ""}`;
  }).join("");
  return wrapLetterhead({
    title: report.title,
    skipCover: true,
    extraCss: CSS,
    cover: { preparedFor: "Management" },
    body: `<p class="kicker">Company report</p><h1>${escapeHtml(report.title)}</h1><p class="meta">${escapeHtml(period)}</p><div class="report-cards">${cards}</div>${sections}`,
  }, assets);
}
