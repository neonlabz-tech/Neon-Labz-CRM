import { PAGINATE_SCRIPT } from "./paginate";

/** Saves a document as a PDF in the browser's own downloads folder. The pages are drawn as pictures, the way the first version of the CRM did it. */

const PAGE_W = 595.28;
const PAGE_H = 841.89;

type Shot = { bytes: Uint8Array; width: number; height: number };

const pdfName = (name: string) => `${name.replace(/\.(pdf|html?)$/i, "") || "document"}.pdf`;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const raw = atob(dataUrl.split(",")[1] ?? "");
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Cuts one tall picture into A4-shaped slices. */
function slices(canvas: HTMLCanvasElement): Shot[] {
  const pageHeight = Math.round(canvas.width * (297 / 210));
  const shots: Shot[] = [];
  for (let top = 0; top < canvas.height; top += pageHeight) {
    const height = Math.min(pageHeight, canvas.height - top);
    if (shots.length && height < pageHeight * 0.04) break;
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = height;
    const context = slice.getContext("2d");
    if (!context) continue;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height);
    shots.push({ bytes: dataUrlToBytes(slice.toDataURL("image/jpeg", 0.98)), width: slice.width, height: slice.height });
  }
  return shots;
}

/** Writes a small PDF where every page is one JPEG picture. */
function toPdf(pages: Shot[]): Blob {
  const encoder = new TextEncoder();
  const objects: (string | Shot)[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  pages.forEach((page, index) => {
    const pageNo = 3 + index * 3;
    const drawH = Math.min((page.height * PAGE_W) / page.width, PAGE_H);
    objects[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 ${pageNo + 1} 0 R >> >> /Contents ${pageNo + 2} 0 R >>`;
    objects[pageNo + 1] = page;
    objects[pageNo + 2] = `q\n${PAGE_W.toFixed(2)} 0 0 ${drawH.toFixed(2)} 0 ${(PAGE_H - drawH).toFixed(2)} cm\n/Im0 Do\nQ\n`;
  });

  const parts: (string | Uint8Array)[] = ["%PDF-1.4\n"];
  const size = () => parts.reduce((sum, part) => sum + (typeof part === "string" ? encoder.encode(part).length : part.length), 0);
  const offsets: number[] = [0];
  for (let i = 1; i < objects.length; i += 1) {
    const body = objects[i];
    if (body === undefined) continue;
    offsets[i] = size();
    if (typeof body !== "string") {
      parts.push(`${i} 0 obj << /Type /XObject /Subtype /Image /Width ${body.width} /Height ${body.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${body.bytes.length} >>\nstream\n`, body.bytes, "\nendstream\nendobj\n");
    } else if (body.startsWith("<<")) {
      parts.push(`${i} 0 obj ${body} endobj\n`);
    } else {
      parts.push(`${i} 0 obj << /Length ${encoder.encode(body).length} >>\nstream\n${body}\nendstream\nendobj\n`);
    }
  }
  const xref = size();
  parts.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < objects.length; i += 1) parts.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  parts.push(`trailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  const chunks = parts.map((part) => (typeof part === "string" ? encoder.encode(part) : part));
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  return new Blob([bytes], { type: "application/pdf" });
}

/**
 * The "payment approved" stamp is a small SVG. html2canvas does not draw it, so it is painted onto a canvas here
 * (same shapes as the stamp in brand.ts) and put back as a picture.
 */
function sealToImage(doc: Document) {
  doc.querySelectorAll("svg.seal").forEach((svg) => {
    const canvas = document.createElement("canvas");
    canvas.width = 560;
    canvas.height = 560;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(2, 2);
    context.translate(140, 140);
    context.rotate((-18 * Math.PI) / 180);
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#16a34a";
    context.lineWidth = 14;
    context.beginPath();
    context.arc(0, 0, 124, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.lineWidth = 6;
    context.beginPath();
    context.arc(0, 0, 104, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#16a34a";
    context.font = '800 26px "NL Sans", Arial, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("PAYMENT", 0, -14);
    context.fillText("APPROVED", 0, 18);
    const image = doc.createElement("img");
    image.className = "seal";
    image.alt = "Payment approved";
    image.src = canvas.toDataURL("image/png");
    svg.replaceWith(image);
  });
}

const waitForImages = (doc: Document) =>
  Promise.all(Array.from(doc.querySelectorAll("img")).map((image) => (image.complete && image.naturalWidth ? Promise.resolve() : new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    setTimeout(resolve, 2000);
  }))));

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("image"));
  reader.readAsDataURL(blob);
});

/** A picture inside an SVG cannot load other files, so every image has to be inlined first. Throws when one cannot be. */
async function inlineImages(doc: Document): Promise<void> {
  for (const image of Array.from(doc.querySelectorAll("img"))) {
    const src = image.getAttribute("src") ?? "";
    if (!src || src.startsWith("data:")) continue;
    const response = await fetch(src, { credentials: "same-origin" });
    if (!response.ok) throw new Error("image");
    image.setAttribute("src", await blobToDataUrl(await response.blob()));
  }
}

/**
 * Draws the document with the browser's own renderer (the page is put inside an SVG and painted onto a canvas).
 * Words, fonts and line positions come out exactly as in the preview, which html2canvas cannot promise.
 */
async function drawNative(doc: Document, width: number, height: number, scale: number): Promise<HTMLCanvasElement> {
  const markup = new XMLSerializer().serializeToString(doc.documentElement);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">${markup}</foreignObject></svg>`;
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("svg"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.getImageData(0, 0, 1, 1); // throws if the browser marked the picture as unsafe, so the caller can fall back
  return canvas;
}

/** Fetches the finished document, draws every page and downloads the PDF. */
export async function downloadPdf(htmlUrl: string, fallbackName: string): Promise<void> {
  const response = await fetch(htmlUrl, { credentials: "same-origin" });
  if (!response.ok) throw new Error("Could not load the document.");
  const name = decodeURIComponent(response.headers.get("X-Document-Name") ?? "") || fallbackName;
  const html = await response.text();

  // The picture is drawn on a canvas that belongs to this page, so the document's own font has to be known here too.
  // Without it the canvas uses a fallback font and the words land in the wrong places.
  const fontCss = (html.match(/@font-face\s*\{[^}]*\}/g) ?? []).join("\n");
  const fontStyle = document.createElement("style");
  fontStyle.textContent = fontCss;
  if (fontCss) {
    document.head.append(fontStyle);
    await Promise.all([400, 500, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 16px "NL Sans"`)));
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("inert", "");
  frame.style.cssText = "position:fixed;left:0;top:0;width:794px;height:1123px;border:0;opacity:0.015;pointer-events:none;background:#fff;";
  document.body.append(frame);
  try {
    const doc = frame.contentDocument;
    const win = frame.contentWindow as (Window & { eval: (code: string) => unknown }) | null;
    if (!doc || !win) throw new Error("Could not open the document.");
    doc.open();
    doc.write(html);
    doc.close();
    sealToImage(doc);

    // html2canvas draws a list's own markers as tiny raised dots, so bullets are drawn as text instead.
    const bullets = doc.createElement("style");
    bullets.textContent = ".doc-body ul { list-style: none !important; padding-left: 0 !important; } .doc-body ul > li { position: relative; padding-left: 16px; } .doc-body ul > li::before { content: \"\\2022\"; position: absolute; left: 3px; }";
    doc.head.append(bullets);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await waitForImages(doc);
    await doc.fonts?.ready;
    doc.querySelectorAll("button.print").forEach((button) => button.remove());


    const letterhead = Boolean(win.eval(PAGINATE_SCRIPT));
    // Sharper pictures are better to read when zoomed, so draw at up to 3x. A browser cannot make a canvas taller than about 32,000 pixels, so long documents use a smaller scale.
    const scaleFor = (height: number) => Math.max(1.5, Math.min(3, 30000 / height));
    let native = true;
    try { await inlineImages(doc); } catch { native = false; }
    const { default: html2canvas } = await import("html2canvas");
    const fallback = (node: HTMLElement, width: number, height: number) =>
      html2canvas(node, { scale: scaleFor(height), backgroundColor: "#ffffff", useCORS: true, logging: false, scrollX: 0, scrollY: 0, x: 0, y: 0, width, height, windowWidth: width, windowHeight: height });
    // The browser's own renderer first; html2canvas only if that is not possible (an image that cannot be inlined, or a browser that blocks it).
    const draw = async (node: HTMLElement, width: number, height: number) => {
      if (native) {
        try { return await drawNative(doc, width, height, scaleFor(height)); } catch { native = false; }
      }
      return fallback(node, width, height);
    };

    const shots: Shot[] = [];
    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".pdf-page"));
    if (letterhead && pages.length) {
      for (const page of pages) {
        pages.forEach((item) => { item.style.display = item === page ? "flex" : "none"; });
        Object.assign(page.style, { height: "1123px", overflow: "hidden", margin: "0", boxShadow: "none" });
        frame.style.height = "1123px";
        shots.push(...slices(await draw(page, 794, 1123)));
      }
    } else {
      const sheet = doc.querySelector<HTMLElement>(".sheet") ?? doc.body;
      // A sheet laid out as a column (the quotation) keeps its footer at the bottom of the A4 page, so it stays one full page tall.
      const pinned = win.getComputedStyle(sheet).display === "flex";
      Object.assign(sheet.style, { margin: "0", boxShadow: "none", minHeight: pinned ? "1123px" : "0" });
      const width = Math.max(sheet.scrollWidth, sheet.offsetWidth, 794);
      const height = Math.max(sheet.scrollHeight, sheet.offsetHeight);
      frame.style.height = `${height}px`;
      shots.push(...slices(await draw(sheet, width, height)));
    }

    const url = URL.createObjectURL(toPdf(shots));
    const link = document.createElement("a");
    link.href = url;
    link.download = pdfName(name);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    frame.remove();
    fontStyle.remove();
  }
}
