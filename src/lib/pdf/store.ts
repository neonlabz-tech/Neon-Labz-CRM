import "server-only";
import { randomUUID } from "node:crypto";
import { uploadToR2, type R2Folder } from "../r2";
import { fontFace, invoiceLogo, letterheadLogo } from "./assets";
import type { Assets } from "./documents";
import { renderPdf } from "./render";

export const letterheadAssets = async (): Promise<Assets> => ({ logo: await invoiceLogo(), font: await fontFace() });
/** The quotation has a white header, so it uses the logo with dark lettering. */
export const quotationAssets = async (): Promise<Assets> => ({ logo: await letterheadLogo(), font: await fontFace() });
/** Invoices and package sheets have a dark header, so they use the logo with white lettering. */
export const invoiceAssets = async (): Promise<Assets> => ({ logo: await invoiceLogo(), font: await fontFace() });

/** Renders the document and saves it in Cloudflare R2. The random part keeps the link private to people who were given it. */
export async function renderAndStore(folder: R2Folder, name: string, html: string): Promise<string> {
  return uploadToR2(folder, `${randomUUID()}-${name}.pdf`, await renderPdf(html), "application/pdf");
}

export const pdfResponse = (bytes: Buffer, name: string) =>
  new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"`, "Cache-Control": "private, no-store" } });
