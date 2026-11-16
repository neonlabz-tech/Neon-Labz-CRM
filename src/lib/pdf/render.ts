import "server-only";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { PAGINATE_SCRIPT } from "./paginate";

const PAGE_HEIGHT = 1122;

async function launch() {
  const local = process.env.CHROME_PATH;
  if (local) return puppeteer.launch({ executablePath: local, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  return puppeteer.launch({ executablePath: await chromium.executablePath(), headless: "shell", args: chromium.args });
}

/** Turns one finished HTML document into an A4 PDF. */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: PAGE_HEIGHT });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const letterhead = await page.evaluate(PAGINATE_SCRIPT) as number;
    if (letterhead) {
      await page.addStyleTag({
        content: `html, body { background: #fff !important; }
          .pdf-doc { margin: 0 !important; }
          .pdf-page { height: ${PAGE_HEIGHT}px !important; margin: 0 !important; box-shadow: none !important; overflow: hidden; break-after: page; }
          .pdf-page:last-child { break-after: auto; }`,
      });
    }
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
