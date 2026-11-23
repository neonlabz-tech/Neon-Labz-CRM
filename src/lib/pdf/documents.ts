import { cleanRich, packageScopeHtml, richToHtml } from "@/lib/rich-text";
import type { InferSchemaType } from "mongoose";
import { docDate, extractScopeBullets, money, renderBrandDocument, type BrandModel } from "./brand";
import { escapeHtml, formatCoverDate, wrapLetterhead } from "./letterhead";
import { renderQuotationDocument } from "./quotation-doc";
import { resolveIcon } from "../package-icons";

export type Assets = { logo: string; font: string };

type Text = string | null | undefined;
type Row = Record<string, Text>;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}
function hasText(value: unknown): boolean {
  return Boolean(text(value).trim());
}
function joinHtml(parts: string[]): string {
  return parts.filter(Boolean).join("");
}
function lines(value: unknown): string[] {
  return text(value).split(/\n/).map((line) => line.trim()).filter(Boolean);
}

function formatQuoteDate(iso?: Text): string {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDate(iso?: Text): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(value?: Text): string {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function weekday(iso?: Text): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { weekday: "long" });
}

function periodLabel(start?: Text, end?: Text): string {
  if (!start && !end) return "Period not set";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start || end);
}

function moneyLabel(value: unknown): string {
  const raw = text(value).trim();
  if (!raw) return "";
  if (/^lkr/i.test(raw)) return raw;
  const number = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(number)) return raw;
  return `LKR ${number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ---------- Quotation ---------- */

export type QuoteInput = {
  number: string; client: string; date: string; terms: string; address?: string; valid?: string; email?: string; phone?: string;
  items: { packageName: string; price: number; scope: string; service?: string | null; period?: string | null; icon?: string | null }[];
  subtotal: number; discountPercent: number; discount: number; total: number;
};

export function quotationHtml(quote: QuoteInput, assets: Assets): string {
  return renderQuotationDocument({
    number: quote.number, client: quote.client, address: quote.address ?? "", email: quote.email ?? "", phone: quote.phone ?? "",
    date: quote.date, valid: quote.valid ?? "",
    items: quote.items.map((line) => ({ name: line.packageName, sub: [line.service, line.period].filter((part) => part && part !== "Custom quotation").join(" · "), icon: resolveIcon(line.icon, line.packageName, line.service ?? ""), scopeHtml: richToHtml(text(line.scope)), price: line.price })),
    subtotal: quote.subtotal, discountPercent: quote.discountPercent, discount: quote.discount, total: quote.total, terms: quote.terms,
  }, assets.logo, assets.font);
}

/* ---------- Receipt / invoice and package sheet ---------- */

export type ReceiptInput = {
  receiptNo: string; date: string; clientName: string; contact: string; projectDetail: string; amount: number;
  type: string; method: string; transactionId: string; quoteTotal: number; approval: string;
};

export type ReceiptQuote = { items: { packageName: string; price: number; scope: string }[]; terms: string; total: number };

function splitBullets(scope: string[]): Pick<BrandModel, "scopeItems" | "featureItems"> {
  const mid = Math.ceil(scope.length / 2) || 0;
  return { scopeItems: scope.slice(0, mid || scope.length), featureItems: scope.slice(mid) };
}

function invoiceLines(items: { packageName: string; price: number }[], total: number): BrandModel["lines"] {
  const rows: BrandModel["lines"] = items.map((item, index) => ({ name: item.packageName || `Package ${index + 1}`, detail: "", qty: "01", rate: money(item.price), amount: money(item.price) }));
  const sum = items.reduce((n, item) => n + item.price, 0);
  if (total && sum - total > 0.5) rows.push({ name: "Offer discount", detail: "", qty: "—", rate: "—", amount: `- ${money(sum - total)}` });
  return rows;
}

/** `paid` is what has already been confirmed for the quotation; the receipt itself shows only what this payment covers. */
export function receiptHtml(receipt: ReceiptInput, quote: ReceiptQuote | null, assets: Assets, paid = 0): string {
  const approved = receipt.approval === "approved";
  const items = quote?.items.length ? quote.items : [{ packageName: receipt.projectDetail || receipt.type || "Service", price: receipt.amount, scope: "" }];
  const total = quote?.total || receipt.quoteTotal || receipt.amount;
  const balance = Math.max(0, total - paid - (approved ? 0 : receipt.amount));
  const how = receipt.method ? `${receipt.method}${receipt.transactionId ? ` · ${receipt.transactionId}` : ""}` : "";
  const model: Partial<BrandModel> = {
    variant: "invoice",
    title: "Invoice.",
    subtitle: items.map((item) => item.packageName).filter(Boolean).join(", ") || "Service package",
    preparedName: receipt.clientName || "Client / Company Name",
    preparedNote: receipt.contact || "Client details from NeonLabz CRM",
    documentId: receipt.receiptNo,
    documentDate: docDate(receipt.date),
    documentMeta: "Project / Per project",
    // One row per package on the quotation, so five packages show as five rows. The box below shows what this payment covers.
    lines: invoiceLines(items, quote?.items.length ? total : 0),
    ...splitBullets(items.flatMap((item) => extractScopeBullets(item.scope))),
    investmentLabel: approved ? "Amount paid" : "Amount due",
    investment: receipt.amount,
    investmentNote: [`Total LKR ${money(total)}`, balance === 0 && approved ? "Balance LKR 0.00 · PAID IN FULL" : `Balance LKR ${money(balance)}`, approved ? (how ? `Approved · ${how}` : "Payment approved") : ""].filter(Boolean).join("\n"),
    scopeHtml: quote?.items.length ? cleanRich(quote.items.map((item) => richToHtml(text(item.scope))).join("")) : "",
    termsHtml: quote?.terms ? cleanRich(richToHtml(quote.terms)) : "",
    pricingNote: approved ? (balance === 0 ? "Paid in full. Thank you for your business." : "This invoice is issued after payment approval.") : "Scope and pricing are indicative until payment is approved.",
    pageLabel: "01 / 01",
    approved,
  };
  return renderBrandDocument(model, assets.logo, assets.font);
}

export type PackageInput = { name: string; service: string; period: string; price: number; scope: string };

export function packageHtml(item: PackageInput, assets: Assets): string {
  const model: Partial<BrandModel> = {
    variant: "package",
    title: "Service Package",
    subtitle: [item.name, item.service].filter(Boolean).join(" | "),
    documentDate: docDate(new Date().toISOString().slice(0, 10)),
    documentMeta: item.period || "Per project",
    lines: [{ name: item.name, detail: item.service, qty: "01", rate: money(item.price), amount: money(item.price) }],
    scopeHtml: cleanRich(richToHtml(item.scope)),
    investment: item.price,
    pageLabel: "01 / 01",
  };
  return renderBrandDocument(model, assets.logo, assets.font);
}

/* ---------- SRS and proposal ---------- */

function labeled(label: string, value: unknown): string {
  return hasText(value) ? `<p><strong>${escapeHtml(label)}</strong></p><p>${escapeHtml(text(value))}</p>` : "";
}

function miniCard(kicker: string, value: unknown): string {
  return hasText(value) ? `<div class="card"><p class="kicker">${escapeHtml(kicker)}</p><strong>${escapeHtml(text(value))}</strong></div>` : "";
}

function textBlock(heading: string, body: unknown): string {
  const items = lines(body);
  if (!items.length) return "";
  const content = items.length > 1 ? `<ul>${items.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : `<p>${escapeHtml(text(body).trim())}</p>`;
  return `<h2>${escapeHtml(heading)}</h2>${content}`;
}

export type SrsInput = { title: string; date: string; preparedFor?: Text; introduction?: Text; functional?: Text; nonFunctional?: Text; assumptions?: Text };

export function srsHtml(srs: SrsInput, projectLabel: string, assets: Assets): string {
  const meta = [projectLabel, srs.preparedFor, formatQuoteDate(srs.date)].filter(Boolean).join(" · ");
  return wrapLetterhead({
    title: srs.title || "SRS",
    skipCover: true,
    cover: { title: srs.title || "Software Requirements Specification", preparedFor: srs.preparedFor || "Client", period: projectLabel, department: "", source: "Software requirements", date: srs.date, preparedBy: "Neon Labz" },
    body: joinHtml([
      `<p class="kicker">Software Requirements Specification</p>`,
      `<h1>${escapeHtml(srs.title || "SRS")}</h1>`,
      meta ? `<p class="meta">${escapeHtml(meta)}</p>` : "",
      `<div class="cover-cards" style="margin:4px 0 8px"><article><span>PREPARED BY</span><strong>Neon Labz</strong></article><article><span>REPORT DATE</span><strong>${escapeHtml(formatQuoteDate(srs.date) || "")}</strong></article><article><span>DATA SOURCE</span><strong>Software requirements</strong></article></div>`,
      textBlock("Introduction", srs.introduction),
      textBlock("Functional requirements", srs.functional),
      textBlock("Non-functional requirements", srs.nonFunctional),
      textBlock("Assumptions", srs.assumptions),
    ]),
  }, assets);
}

function featureCard(title: Text, role: Text, body: Text): string {
  const items = lines(body);
  if (!hasText(title) && !hasText(role) && !items.length) return "";
  return `<article class="card">${joinHtml([
    hasText(role) ? `<p class="kicker">${escapeHtml(role)}</p>` : "",
    hasText(title) ? `<h3>${escapeHtml(title)}</h3>` : "",
    items.length ? `<ul>${items.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "",
  ])}</article>`;
}

function signCard(kicker: string, name: Text, title: Text, date: Text): string {
  if (!hasText(name) && !hasText(title) && !hasText(date)) return "";
  return `<div class="card">${joinHtml([
    `<p class="kicker">${escapeHtml(kicker)}</p>`,
    hasText(name) ? `<strong>${escapeHtml(text(name))}</strong>` : "",
    hasText(title) ? `<p>${escapeHtml(text(title))}</p>` : "",
    hasText(date) ? `<p>${escapeHtml(formatQuoteDate(date) || text(date))}</p>` : "",
  ])}</div>`;
}

function numberedSections(sections: { title: string; html: string }[]): string {
  return sections.filter((section) => hasText(section.html)).map((section, index) => `<h2>${index + 1}. ${section.title}</h2>${section.html}`).join("");
}

export type ProposalInput = InferSchemaType<typeof import("@/models/report").Proposal.schema>;

export function proposalHtml(proposal: ProposalInput, assets: Assets): string {
  const dashboards = joinHtml([
    featureCard(proposal.customerTitle, proposal.customerRole, proposal.customerFeatures),
    featureCard(proposal.adminTitle, proposal.adminRole, proposal.adminFeatures),
  ]);
  const stackRows = proposal.stack.filter((row) => hasText(row.technology) || hasText(row.purpose));
  const brandCards = proposal.brand.filter((item) => hasText(item.title) || hasText(item.text)).map((item) => (
    `<article class="card">${joinHtml([hasText(item.title) ? `<strong>${escapeHtml(item.title)}</strong>` : "", hasText(item.text) ? `<p>${escapeHtml(item.text)}</p>` : ""])}</article>`
  )).join("");
  const stats = proposal.packageStats.filter((item) => hasText(item.value) || hasText(item.label)).map((item) => (
    `<div>${joinHtml([hasText(item.value) ? `<strong>${escapeHtml(item.value)}</strong>` : "", hasText(item.label) ? `<p>${escapeHtml(item.label)}</p>` : ""])}</div>`
  )).join("");
  const pack = joinHtml([
    hasText(proposal.packageName) || stats
      ? `<div>${joinHtml([
        hasText(proposal.packageName) ? `<p class="kicker">One-time launch pack</p><strong>${escapeHtml(proposal.packageName)}</strong>` : "",
        stats ? `<div class="stats">${stats}</div>` : "",
      ])}</div>`
      : "",
    hasText(proposal.packageInvestment) ? `<div><p class="kicker">Investment</p><strong>${escapeHtml(moneyLabel(proposal.packageInvestment))}</strong></div>` : "",
  ]);
  const budgetRows = proposal.budget.filter((row) => hasText(row.deliverable) || hasText(row.fee) || hasText(row.amount));
  const total = joinHtml([
    hasText(proposal.totalAmount) ? `<p style="display:flex;justify-content:space-between;gap:16px;padding:10px 12px;background:#F7F8FC;border:1px solid #E6E8F2;border-radius:8px"><strong>Total project cost</strong><strong style="color:#873CFF">${escapeHtml(moneyLabel(proposal.totalAmount))}</strong></p>` : "",
    hasText(proposal.totalNote) ? `<p>${escapeHtml(text(proposal.totalNote))}</p>` : "",
  ]);
  const timeline = joinHtml([miniCard("Duration", proposal.duration), miniCard("Earliest start", formatQuoteDate(proposal.startDate)), miniCard("Production launch", formatQuoteDate(proposal.launchDate))]);
  const terms = lines(proposal.terms).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const signatures = joinHtml([
    signCard("Client authorized signatory", proposal.clientSignName, proposal.clientSignTitle, proposal.clientSignDate),
    signCard("Neon Labz (Pvt) Ltd", proposal.companySignName, proposal.companySignTitle, proposal.companySignDate),
  ]);
  const basicsLeft = joinHtml([labeled("Client details", proposal.companyScope), labeled("Summary", proposal.summary)]);
  const basicsRight = joinHtml([labeled("Prepared for", proposal.preparedFor), labeled("Validity", proposal.validity)]);
  const meta = [hasText(proposal.preparedFor) ? `Prepared for ${proposal.preparedFor}` : "", formatQuoteDate(proposal.date)].filter(Boolean).join(" · ");
  const table = (head: string[], body: string) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;

  return wrapLetterhead({
    title: proposal.title || "Proposal",
    skipCover: true,
    cover: { title: proposal.title || "Proposal", preparedFor: proposal.preparedFor || "Client", period: proposal.subtitle || "", department: "", source: "Client proposal", date: proposal.date, preparedBy: "Neon Labz" },
    extraCss: ".stats{display:flex;gap:18px}.stats strong{display:block;font-size:20px}.pack{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px}",
    body: joinHtml([
      `<p class="kicker">Client proposal</p>`,
      `<h1>${escapeHtml(proposal.title || "Proposal")}</h1>`,
      hasText(proposal.subtitle) ? `<p class="meta">${escapeHtml(text(proposal.subtitle))}</p>` : "",
      meta ? `<p class="meta">${escapeHtml(meta)}</p>` : "",
      `<div class="cover-cards" style="margin:4px 0 8px"><article><span>PREPARED BY</span><strong>Neon Labz</strong></article><article><span>REPORT DATE</span><strong>${escapeHtml(formatQuoteDate(proposal.date) || "")}</strong></article><article><span>DATA SOURCE</span><strong>Client proposal</strong></article></div>`,
      numberedSections([
        {
          title: "Basic details &amp; proposal foundation",
          html: basicsLeft || basicsRight ? `<div class="grid-2">${joinHtml([basicsLeft ? `<div>${basicsLeft}</div>` : "", basicsRight ? `<div class="card">${basicsRight}</div>` : ""])}</div>` : "",
        },
        { title: "Website &amp; customer dashboard architecture", html: dashboards ? `<div class="grid-2">${dashboards}</div>` : "" },
        {
          title: "Admin &amp; technical setup",
          html: stackRows.length ? table(["Layer / component", "Technology", "Purpose"], stackRows.map((row) => `<tr><td>${escapeHtml(row.layer)}</td><td>${escapeHtml(row.technology)}</td><td>${escapeHtml(row.purpose)}</td></tr>`).join("")) : "",
        },
        { title: "Marketing &amp; branding strategy", html: joinHtml([brandCards ? `<div class="grid-3">${brandCards}</div>` : "", pack ? `<div class="card pack">${pack}</div>` : ""]) },
        {
          title: "Budget, payment &amp; timeline",
          html: joinHtml([
            budgetRows.length ? table(["Deliverables", "One-time fee", "Investment (LKR)"], budgetRows.map((row) => `<tr><td>${escapeHtml(row.deliverable)}</td><td>${escapeHtml(row.fee)}</td><td>${escapeHtml(row.amount ? moneyLabel(row.amount) : "")}</td></tr>`).join("")) : "",
            total ? `<div class="card">${total}</div>` : "",
            timeline ? `<div class="grid-3">${timeline}</div>` : "",
          ]),
        },
        { title: "Scope, terms &amp; acceptance", html: joinHtml([terms ? `<ul>${terms}</ul>` : "", signatures ? `<div class="sign">${signatures}</div>` : ""]) },
      ]),
    ]),
  }, assets);
}

/* ---------- Marketing: report, info sheet, content plan ---------- */

function fieldValue(value: unknown): string {
  return escapeHtml(text(value).trim() || "—");
}
function contactLine(name: Text, title: Text): string {
  if (!name && !title) return "—";
  return title ? `${name}, ${title}` : text(name);
}
function detailLine(label: string, value: unknown): string {
  return `<p>${escapeHtml(label)}: ${fieldValue(value)}</p>`;
}

const PROFILE_CSS = `
  .doc-body { padding: 26px 42px 12px; }
  .doc-body h1 { margin: 0 0 4px; font-size: 32px; line-height: 1.05; font-weight: 800; letter-spacing: -.03em; color: #0B1026; }
  .doc-body .meta { margin: 0 0 16px; color: #8B90A5; font-size: 13px; }
  table.profile-meta { margin: 0 0 22px; background: #F4F6FB; }
  table.profile-meta td { width: 33.33%; border: 0; background: #F4F6FB; padding: 12px 14px; vertical-align: top; }
  table.profile-meta span { display: block; color: #873CFF; font-size: 10px; font-weight: 700; letter-spacing: .08em; }
  table.profile-meta strong { display: block; margin-top: 4px; color: #1A2042; font-size: 13px; font-weight: 600; }
  h2.section-title { margin: 20px 0 0; padding: 0 0 8px; border-bottom: 2px solid #873CFF; font-size: 18px; font-weight: 800; color: #0B1026; }
  table.pair { margin: 14px 0 8px; }
  table.pair td { width: 50%; border: 0; background: transparent; padding: 0 28px 0 0; vertical-align: top; }
  table.pair td + td { padding: 0 0 0 12px; }
  table.pair h3 { margin: 0 0 8px; color: #873CFF; font-size: 11px; font-weight: 700; letter-spacing: .08em; }
  table.pair p { margin: 0 0 5px; color: #1A2042; font-size: 13px; }
  table.brand { width: 100%; margin: 12px 0 0; border: 1px solid #E4E7F0; }
  table.brand th { width: 28%; background: #F4F6FB; color: #1A2042; font-size: 13px; font-weight: 600; letter-spacing: 0; text-transform: none; padding: 10px 14px; border-bottom: 1px solid #E4E7F0; }
  table.brand td { background: #fff; color: #1A2042; font-size: 13px; font-weight: 500; padding: 10px 14px; border-bottom: 1px solid #E4E7F0; }
  table.brand tr:last-child th, table.brand tr:last-child td { border-bottom: 0; }
  table.credentials { margin-top: 14px; border: 1px solid #E4E7F0; }
  table.credentials th { background: #1A2042; color: #fff; font-size: 11px; letter-spacing: .08em; padding: 10px 14px; }
  table.credentials td { padding: 11px 14px; font-size: 13px; color: #1A2042; border-bottom: 1px solid #E8EAF2; }
  table.credentials td:first-child { width: 30%; font-weight: 700; background: #F4F6FB; }
  table.credentials tbody tr:nth-child(odd) td:last-child { background: #fff; }
  table.credentials tbody tr:nth-child(even) td:last-child { background: #F7F8FC; }
  .note { margin: 12px 0 0; color: #873CFF; font-size: 12px; }
`;

export type InfoInput = Record<string, string | null | undefined> & { brandName: string; social: Record<string, { username?: Text; password?: Text; pageLink?: Text }> };

const SOCIAL_ROWS: [string, string][] = [["email", "Business mail"], ["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["linkedin", "LinkedIn"]];

/** `social` passwords must already be decrypted by the caller. */
export function infoHtml(client: InfoInput, clientCode: string, assets: Assets): string {
  const brand = client.brandName || "Client";
  const credentials = SOCIAL_ROWS.map(([id, label]) => {
    const account = client.social[id];
    const value = account ? [account.username, account.password, account.pageLink].filter(Boolean).join(" / ") : "";
    return `<tr><td>${label}</td><td>${fieldValue(value)}</td></tr>`;
  }).join("");
  return wrapLetterhead({
    lightHead: true,
    title: `${brand} client profile`,
    profile: true,
    cover: { preparedFor: brand },
    extraCss: PROFILE_CSS,
    body: `
      <h1>${escapeHtml(brand)}</h1>
      <p class="meta">Client information profile  •  Client ID ${escapeHtml(clientCode)}</p>
      <table class="profile-meta"><tr>
        <td><span>PREPARED BY</span><strong>Marketing team</strong></td>
        <td><span>REPORT DATE</span><strong>${escapeHtml(formatCoverDate())}</strong></td>
        <td><span>DATA SOURCE</span><strong>Client info document</strong></td>
      </tr></table>
      <h2 class="section-title">01&nbsp;&nbsp;Client and business details</h2>
      <table class="pair"><tr>
        <td>
          <h3>CLIENT DETAILS</h3>
          ${detailLine("Main contact", contactLine(client.mainContactName, client.mainContactTitle))}
          ${detailLine("Assigned contact", contactLine(client.assignedContactName, client.assignedContactTitle))}
        </td>
        <td>
          <h3>BUSINESS DETAILS</h3>
          ${detailLine("Legal name", client.legalName)}
          ${detailLine("Industry", client.industry)}
          ${detailLine("Email", client.email)}
          ${detailLine("Phone", client.phone)}
          ${detailLine("Website", client.website)}
          ${detailLine("Address", client.address)}
          ${detailLine("Hours", client.hours)}
          ${detailLine("Preferred contact", client.preferredContact)}
        </td>
      </tr></table>
      <h2 class="section-title">02&nbsp;&nbsp;Brand identity</h2>
      <table class="brand"><tbody>
        <tr><th>Primary colour</th><td>${fieldValue(client.primaryColor)}</td></tr>
        <tr><th>Accent colours</th><td>${fieldValue(client.secondaryColors)}</td></tr>
        <tr><th>Fonts</th><td>${fieldValue(client.fonts)}</td></tr>
        <tr><th>Tagline</th><td>${fieldValue(client.tagline)}</td></tr>
      </tbody></table>
      <div class="pdf-break">
        <p class="meta">Social media and account credentials  •  Client ${escapeHtml(clientCode)}</p>
        <h2 class="section-title">03&nbsp;&nbsp;Social media credentials</h2>
        <table class="credentials">
          <thead><tr><th>Platform</th><th>Account details</th></tr></thead>
          <tbody>${credentials}</tbody>
        </table>
        <p class="note"><strong>Note:</strong> Account details are reproduced as provided in the source document.</p>
      </div>
    `,
  }, assets);
}

type PlanPost = { date?: Text; time?: Text; topic?: Text; type?: Text };
type PlanAd = Record<string, Text>;
export type PlanInput = {
  title: string; startDate?: Text; endDate?: Text; address?: Text; cadence?: Text; confirmNotes?: Text;
  months: { label?: Text; theme?: Text; startDate?: Text; endDate?: Text; posts: PlanPost[]; ad?: PlanAd | null }[];
};

function postTypeLabel(value: unknown): string {
  return /^(video|reel)$/i.test(text(value).trim()) ? "Reel" : "Poster";
}
function cell(value: unknown): string {
  return escapeHtml(text(value).trim() || "—");
}

function adTable(ad: PlanAd | null | undefined): string {
  if (!ad) return "";
  const rows = ([
    ["Date", formatDate(ad.date)], ["Day", weekday(ad.date)], ["Time", formatTime(ad.time)], ["Platforms", text(ad.platforms).split(",").map((p) => p.trim()).filter(Boolean).join(", ")], ["Ad type", ad.adType],
    ["Objective", ad.objective], ["Duration", ad.duration], ["Target", ad.target], ["Product", ad.product], ["Offer", ad.offer],
    ["Main message", ad.message], ["Creative", ad.creative],
  ] as [string, Text][]).filter(([, value]) => text(value).trim());
  if (!rows.length) return "";
  return `<h3>Paid ad campaign</h3><table class="ad-table"><thead><tr><th>Detail</th><th>Value</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table>`;
}

export function planHtml(plan: PlanInput, clientName: string, assets: Assets): string {
  const notes = lines(plan.confirmNotes);
  const months = plan.months.map((month) => {
    const rows = month.posts.length
      ? month.posts.map((post) => `<tr><td>${cell(formatDate(post.date) || "Date not set")}</td><td>${cell(weekday(post.date))}</td><td>${cell(formatTime(post.time))}</td><td>${cell(post.topic || "Untitled")}</td><td>${cell(postTypeLabel(post.type))}</td></tr>`).join("")
      : `<tr><td colspan="5">No posts recorded for this month.</td></tr>`;
    return `
      <h2>${escapeHtml(month.label || "Month")}${month.theme ? ` · ${escapeHtml(month.theme)}` : ""}</h2>
      <p class="meta">${escapeHtml(periodLabel(month.startDate, month.endDate))}</p>
      <table class="plan-table"><thead><tr><th>Date</th><th>Day</th><th>Time</th><th>Topic</th><th>Type</th></tr></thead><tbody>${rows}</tbody></table>
      ${adTable(month.ad)}`;
  }).join("");
  return wrapLetterhead({
    lightHead: true,
    title: plan.title || "Content plan",
    skipCover: true,
    cover: { title: plan.title || "Content plan", preparedFor: clientName || "Client", period: periodLabel(plan.startDate, plan.endDate), department: "Marketing", source: "Content plan", date: text(plan.endDate || plan.startDate), preparedBy: "Marketing team" },
    extraCss: `
      .plan-table { table-layout: fixed; }
      .plan-table th:nth-child(1), .plan-table td:nth-child(1) { width: 18%; }
      .plan-table th:nth-child(2), .plan-table td:nth-child(2) { width: 16%; }
      .plan-table th:nth-child(3), .plan-table td:nth-child(3) { width: 14%; }
      .plan-table th:nth-child(4), .plan-table td:nth-child(4) { width: 36%; }
      .plan-table th:nth-child(5), .plan-table td:nth-child(5) { width: 16%; }
      .plan-table td, .plan-table th, .ad-table td, .ad-table th { overflow-wrap: anywhere; }
      .ad-table td:first-child { width: 28%; font-weight: 700; }
    `,
    body: `
      <p class="kicker">Content plan</p>
      <h1>${escapeHtml(plan.title || "Content plan")}</h1>
      <p>${escapeHtml(clientName || "Client")}</p>
      <p class="meta">${escapeHtml(periodLabel(plan.startDate, plan.endDate))}${plan.address ? ` · ${escapeHtml(text(plan.address))}` : ""}</p>
      ${plan.cadence ? `<p>${escapeHtml(text(plan.cadence))}</p>` : ""}
      ${months}
      ${notes.length ? `<h2>To confirm</h2><ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : ""}
    `,
  }, assets);
}
