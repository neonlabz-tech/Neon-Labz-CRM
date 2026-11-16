import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, string>();

async function dataUri(file: string, type: string): Promise<string> {
  const hit = cache.get(file);
  if (hit) return hit;
  const bytes = await readFile(path.join(process.cwd(), "public", "pdf", file));
  const uri = `data:${type};base64,${bytes.toString("base64")}`;
  cache.set(file, uri);
  return uri;
}

export const letterheadLogo = () => dataUri("letterhead-logo.png", "image/png");
export const invoiceLogo = () => dataUri("invoice-logo.png", "image/png");
/** The same font on every server, so the PDF looks the same wherever it is made. */
export const fontFace = async () =>
  `@font-face { font-family: "NL Sans"; src: url(${await dataUri("font.woff2", "font/woff2")}) format("woff2"); font-weight: 200 800; }`;
