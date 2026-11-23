import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { can, ownerScope, type Role } from "@/lib/permissions";
import { isId } from "@/lib/project-access";
import { infoHtml, packageHtml, planHtml, proposalHtml, quotationHtml, receiptHtml, srsHtml, type InfoInput, type PlanInput } from "@/lib/pdf/documents";
import { marketingReportHtml, type ReportDocInput } from "@/lib/pdf/marketing-report";
import { invoiceAssets, letterheadAssets, pdfResponse, quotationAssets, renderAndStore } from "@/lib/pdf/store";
import { renderPdf } from "@/lib/pdf/render";
import { buildReport, isReportId, REPORT_TYPES } from "@/lib/company-reports";
import { companyReportHtml } from "@/lib/pdf/company-report";
import { open } from "@/lib/secrets";
import { packageScopeHtml } from "@/lib/rich-text";
import { deleteFromR2 } from "@/lib/r2";
import type { R2Folder } from "@/lib/r2";
import { Client } from "@/models/client";
import { Invoice } from "@/models/invoice";
import { Lead } from "@/models/lead";
import { MarketingInfo } from "@/models/marketing-info";
import { MarketingPlan } from "@/models/marketing-plan";
import { ManualSale } from "@/models/manual-sale";
import { MarketingReport } from "@/models/marketing-report";
import { Package } from "@/models/package";
import { Payment } from "@/models/payment";
import { Project } from "@/models/project";
import { Quotation } from "@/models/quotation";
import { Proposal, Srs } from "@/models/report";
import { SpecialClient, SpecialDoc } from "@/models/special";
import { specialQuotationHtml } from "@/lib/pdf/special-doc";

export const maxDuration = 60;

type User = { username: string; role: Role };
const QUOTATION_PDF_VERSION = 6;
const RECEIPT_PDF_VERSION = 2;
/** `stored` documents are kept in R2 and reused; the others are made on demand and never saved. */
type Source = { name: string; html: () => Promise<string>; stored?: { folder: R2Folder; url: string; save: (url: string) => Promise<unknown> } };
type Loader = (id: string, user: User) => Promise<Source | null>;

const projectLabel = async (code: string) => {
  const project = await Project.findOne({ code }).select("name").lean();
  return project ? `${code} · ${project.name}` : code;
};

const LOADERS: Record<string, Loader> = {
  async quotation(id, user) {
    if (!can(user.role, "quotations.manage")) return null;
    const quote = await Quotation.findOne({ _id: id, ...ownerScope(user) }).lean();
    if (!quote) return null;
    const lead = await Lead.findOne({ leadId: quote.leadId }).select("address").lean();
    return {
      name: quote.number,
      html: async () => quotationHtml({ ...quote, address: lead?.address ?? "" }, await quotationAssets()),
      stored: {
        folder: "quotations",
        url: quote.pdfVersion === QUOTATION_PDF_VERSION ? quote.pdfUrl : "",
        save: async (pdfUrl) => {
          await Quotation.updateOne({ _id: id }, { pdfUrl, pdfVersion: QUOTATION_PDF_VERSION });
          if (quote.pdfUrl && quote.pdfUrl !== pdfUrl) await deleteFromR2(quote.pdfUrl);
        },
      },
    };
  },
  async receipt(id, user) {
    if (user.role !== "superadmin" && user.role !== "sales") return null;
    const receipt = await Invoice.findOne({ _id: id, ...(user.role === "sales" ? { salesOwner: user.username } : {}) }).lean();
    if (!receipt) return null;
    // Only the Super Admin can open a receipt that is still waiting for approval (to review it).
    if (receipt.approval !== "approved" && user.role !== "superadmin") return null;
    const quote = await Quotation.findById(receipt.quoteId).select("items terms total").lean();
    const [{ n: paid = 0 } = { n: 0 }] = await Payment.aggregate<{ n: number }>([{ $match: { quoteId: receipt.quoteId, status: "confirmed" } }, { $group: { _id: null, n: { $sum: "$amount" } } }]);
    return {
      name: receipt.receiptNo,
      html: async () => receiptHtml(receipt, quote, await invoiceAssets(), paid),
      stored: {
        folder: "receipts",
        url: receipt.pdfVersion === RECEIPT_PDF_VERSION ? receipt.pdfUrl : "",
        save: async (pdfUrl) => {
          await Invoice.updateOne({ _id: id }, { pdfUrl, pdfVersion: RECEIPT_PDF_VERSION });
          if (receipt.pdfUrl && receipt.pdfUrl !== pdfUrl) await deleteFromR2(receipt.pdfUrl);
        },
      },
    };
  },
  async srs(id, user) {
    if (!can(user.role, "reports.manage")) return null;
    const srs = await Srs.findOne(user.role === "superadmin" ? { _id: id } : { _id: id, owner: user.username }).lean();
    if (!srs) return null;
    return {
      name: srs.title,
      html: async () => srsHtml(srs, await projectLabel(srs.projectCode), await letterheadAssets()),
      stored: { folder: "reports", url: srs.pdfUrl, save: (pdfUrl) => Srs.updateOne({ _id: id }, { pdfUrl }) },
    };
  },
  async proposal(id, user) {
    if (!can(user.role, "reports.manage")) return null;
    const proposal = await Proposal.findOne(user.role === "superadmin" ? { _id: id } : { _id: id, owner: user.username }).lean();
    if (!proposal) return null;
    return {
      name: proposal.title,
      html: async () => proposalHtml(proposal, await letterheadAssets()),
      stored: { folder: "reports", url: proposal.pdfUrl, save: (pdfUrl) => Proposal.updateOne({ _id: id }, { pdfUrl }) },
    };
  },
  async report(id, user) {
    if (!can(user.role, "marketing.view")) return null;
    const report = await MarketingReport.findById(id).lean();
    if (!report) return null;
    const client = await Client.findOne({ code: report.clientCode }).select("logo").lean();
    return {
      name: `${report.clientName}-${report.title || "report"}`,
      html: async () => marketingReportHtml(JSON.parse(JSON.stringify(report)) as ReportDocInput, await quotationAssets(), client?.logo ?? ""),
      stored: { folder: "reports", url: report.pdfUrl, save: (pdfUrl) => MarketingReport.updateOne({ _id: id }, { pdfUrl }) },
    };
  },
  async plan(id, user) {
    if (!can(user.role, "marketing.view")) return null;
    const plan = await MarketingPlan.findById(id).lean();
    if (!plan) return null;
    return {
      name: plan.title,
      html: async () => planHtml(plan as unknown as PlanInput, plan.clientName, await quotationAssets()),
      stored: { folder: "reports", url: plan.pdfUrl, save: (pdfUrl) => MarketingPlan.updateOne({ _id: id }, { pdfUrl }) },
    };
  },
  /** The id is the client code. Holds login details, so it is only streamed to the signed-in person. Project managers can read it, with the saved passwords left out. */
  async info(code, user) {
    if (!can(user.role, "marketing.view")) return null;
    const showPasswords = can(user.role, "marketing.manage");
    const info = await MarketingInfo.findOne({ clientCode: code }).lean();
    if (!info) return null;
    const social = Object.fromEntries((info.social instanceof Map ? [...info.social.entries()] : Object.entries((info.social ?? {}) as Record<string, unknown>)).map(([key, raw]) => { const value = raw as { password?: string }; return [key, { ...value, password: showPasswords ? open(value.password ?? "") : "" }]; }));
    return { name: `${info.brandName || info.clientName}-profile`, html: async () => infoHtml({ ...info, social } as unknown as InfoInput, info.clientCode, await quotationAssets()) };
  },
  /** One receipt of a manual sale. The id is the sale's id, an underscore and the payment's number. */
  async salepay(id, user) {
    if (!can(user.role, "payments.approve")) return null;
    const [saleId = "", number = ""] = id.split("_");
    const index = Number(number) - 1;
    const sale = isId(saleId) ? await ManualSale.findById(saleId).lean() : null;
    const pay = sale?.payments[index];
    if (!sale || !pay) return null;
    const paid = sale.payments.slice(0, index + 1).reduce((sum, p) => sum + p.amount, 0);
    const client = sale.clientCode ? await Client.findOne({ code: sale.clientCode }).select("email phone").lean() : null;
    const receipt = {
      receiptNo: pay.receiptNo, date: pay.date, clientName: sale.business, contact: [client?.email, client?.phone].filter(Boolean).join(" · "), projectDetail: sale.service,
      amount: pay.amount, type: paid >= sale.amount ? (index === 0 ? "Full payment" : "Final payment") : `Payment ${index + 1}`, method: pay.method, transactionId: pay.transactionId, quoteTotal: sale.amount, approval: "approved",
    };
    return { name: pay.receiptNo, html: async () => receiptHtml(receipt, null, await invoiceAssets(), paid) };
  },
  /** A Super Admin report. The id is `report~from~to`, for example `sales~2026-11-01~2026-11-30`. */
  async company(id, user) {
    if (!can(user.role, "reports.company")) return null;
    const [type = "", from = "", to = ""] = id.split("~");
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (!isReportId(type) || !day.test(from) || !day.test(to)) return null;
    const title = REPORT_TYPES.find((t) => t.id === type)!.title;
    return { name: `${title}-${from}-${to}`, html: async () => companyReportHtml(await buildReport(type, from, to), `${from} to ${to}`, await letterheadAssets()) };
  },
  /** Special Clients documents (Super Admin only). The id is the document's id; they are made on demand and not stored. */
  async spquote(id, user) {
    if (!can(user.role, "special.manage")) return null;
    const quote = await SpecialDoc.findOne({ _id: id, kind: "quotation" }).lean();
    if (!quote) return null;
    const client = isId(quote.clientId) ? await SpecialClient.findById(quote.clientId).select("email phone address").lean() : null;
    return {
      name: quote.number,
      html: async () => specialQuotationHtml({ ...quote, email: client?.email ?? "", phone: client?.phone ?? "", address: client?.address ?? "", items: quote.items.map((i) => ({ name: i.name, price: i.price, scope: i.scope ?? "" })) }, await quotationAssets()),
    };
  },
  /** A proposal or an SRS document of a special client, made with the same layouts as the project reports. */
  async spdoc(id, user) {
    if (!can(user.role, "special.manage")) return null;
    const doc = await SpecialDoc.findOne({ _id: id, kind: { $in: ["proposal", "srs"] } }).lean();
    if (!doc) return null;
    const data = (doc.data ?? {}) as Record<string, unknown>;
    if (doc.kind === "srs") return { name: `${doc.number}-${doc.title}`, html: async () => srsHtml({ ...data, title: doc.title, date: doc.date }, doc.clientName, await letterheadAssets()) };
    const proposal = { stack: [], brand: [], packageStats: [], budget: [], ...data, title: doc.title, date: doc.date } as unknown as Parameters<typeof proposalHtml>[0];
    return { name: `${doc.number}-${doc.title}`, html: async () => proposalHtml(proposal, await letterheadAssets()) };
  },
  /** The client info of a special client (the id is the client's id), with the saved passwords opened for the Super Admin. */
  async spinfo(id, user) {
    if (!can(user.role, "special.manage")) return null;
    const client = await SpecialClient.findById(id).select("code name info infoSaved").lean();
    if (!client || !client.infoSaved) return null;
    const info = (client.info ?? {}) as Record<string, unknown> & { social?: Record<string, { password?: string }> };
    const social = Object.fromEntries(Object.entries(info.social ?? {}).map(([key, value]) => [key, { ...value, password: open(value.password ?? "") }]));
    const brand = String(info.brandName || client.name);
    return { name: `${brand}-profile`, html: async () => infoHtml({ ...info, brandName: brand, social } as unknown as InfoInput, client.code, await quotationAssets()) };
  },
  async package(id, user) {
    if (!can(user.role, "packages.view")) return null;
    const item = await Package.findById(id).select("name category description price duration features included").lean();
    if (!item) return null;
    const scope = packageScopeHtml(item.description ?? "", item.features ?? [], item.included ?? "");
    return { name: item.name, html: async () => packageHtml({ name: item.name, service: item.category, period: item.duration, price: item.price, scope }, await invoiceAssets()) };
  },
};

const fileName = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Please sign in." }, { status: 401 });
  const { kind, id } = await params;
  const load = LOADERS[kind];
  if (!load || (kind !== "info" && kind !== "company" && !isId(kind === "salepay" ? id.split("_")[0] ?? "" : id))) return NextResponse.json({ message: "Document not found." }, { status: 404 });

  await connectDb();
  const source = await load(id, user);
  if (!source) return NextResponse.json({ message: "Document not found." }, { status: 404 });
  // The page itself, for the preview window and for "Download PDF", which draws it in the browser.
  if (new URL(request.url).searchParams.get("format") === "html") {
    try {
      return new Response(await source.html(), { headers: { "Content-Type": "text/html; charset=utf-8", "X-Document-Name": encodeURIComponent(fileName(source.name)), "Cache-Control": "private, no-store" } });
    } catch (error) {
      console.error("Document failed", error);
      return NextResponse.json({ message: "Could not open the document." }, { status: 500 });
    }
  }
  if (source.stored?.url) return NextResponse.redirect(source.stored.url);

  try {
    const html = await source.html();
    if (!source.stored) return pdfResponse(await renderPdf(html), fileName(source.name));
    const url = await renderAndStore(source.stored.folder, fileName(source.name), html);
    await source.stored.save(url);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("PDF failed", error);
    return NextResponse.json({ message: "Could not make the PDF. Please try again." }, { status: 500 });
  }
}
