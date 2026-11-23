import { renderQuotationDocument } from "./quotation-doc";
import { richToHtml } from "../rich-text";
import { resolveIcon } from "../package-icons";
import type { Assets } from "./documents";

export type SpecialQuoteInput = {
  number: string; clientName: string; email: string; phone: string; address: string; date: string; valid: string;
  items: { name: string; price: number; scope: string }[];
  subtotal: number; discountPercent: number; discount: number; total: number; body: string;
};

/** The same quotation layout the sales team uses, filled from a Special Clients quotation. Proposals, SRS documents and client info use the existing project-report and marketing layouts. */
export function specialQuotationHtml(quote: SpecialQuoteInput, assets: Assets): string {
  return renderQuotationDocument({
    number: quote.number, client: quote.clientName, address: quote.address, email: quote.email, phone: quote.phone, date: quote.date, valid: quote.valid,
    items: quote.items.map((line) => ({ name: line.name, sub: "", icon: resolveIcon("", line.name, ""), scopeHtml: richToHtml(line.scope), price: line.price })),
    subtotal: quote.subtotal, discountPercent: quote.discountPercent, discount: quote.discount, total: quote.total, terms: quote.body,
  }, assets.logo, assets.font);
}
