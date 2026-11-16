import "server-only";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { required } from "./env";

let client: S3Client | null = null;

function s3() {
  client ??= new S3Client({
    region: "auto",
    endpoint: required("R2_ENDPOINT"),
    credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") },
  });
  return client;
}

export type R2Folder = "payment-proofs" | "receipts" | "quotations" | "reports" | "packages" | "logos" | "marketing";

export async function uploadToR2(folder: R2Folder, name: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
  const key = `${folder}/${Date.now()}-${name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
  await s3().send(new PutObjectCommand({ Bucket: required("R2_BUCKET_NAME"), Key: key, Body: body, ContentType: contentType }));
  return `${required("R2_PUBLIC_URL").replace(/\/$/, "")}/${key}`;
}

/** Best effort: removes the object behind a public URL that we uploaded earlier. */
export async function deleteFromR2(url: string): Promise<void> {
  const base = `${required("R2_PUBLIC_URL").replace(/\/$/, "")}/`;
  if (!url.startsWith(base)) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: required("R2_BUCKET_NAME"), Key: url.slice(base.length) }));
  } catch (error) {
    console.error("R2 delete failed", error);
  }
}
