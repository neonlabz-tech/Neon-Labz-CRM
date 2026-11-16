import "server-only";
import { uploadToR2, type R2Folder } from "./r2";

type Rules = { images?: boolean; pdf?: boolean; maxMb: number; what: string };
type Result = { url: string; error?: undefined } | { url?: undefined; error: string };

const IMAGES = ["image/jpeg", "image/png", "image/webp"];

/** Checks a file picked in a form and stores it in Cloudflare R2. No file picked gives an empty URL. */
export async function uploadFile(entry: FormDataEntryValue | null, folder: R2Folder, rules: Rules): Promise<Result> {
  if (!(entry instanceof File) || entry.size === 0) return { url: "" };
  if (entry.size > rules.maxMb * 1024 * 1024) return { error: `The ${rules.what} must be ${rules.maxMb} MB or smaller.` };
  const allowed = [...(rules.images ? IMAGES : []), ...(rules.pdf ? ["application/pdf"] : [])];
  if (!allowed.includes(entry.type)) return { error: `The ${rules.what} must be ${rules.pdf ? "an image or a PDF" : "a JPG, PNG or WebP image"}.` };
  try {
    return { url: await uploadToR2(folder, entry.name, Buffer.from(await entry.arrayBuffer()), entry.type) };
  } catch (error) {
    console.error("R2 upload failed", error);
    return { error: `The ${rules.what} could not be uploaded. Check the Cloudflare R2 settings in .env.local.` };
  }
}
