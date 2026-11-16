import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";

const key = () => createHash("sha256").update(env.jwtSecret()).digest();

/** Encrypts a stored secret such as a social media password, so it is not readable in the database. */
export function seal(value: string): string {
  if (!value) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64")).join(".");
}

export function open(value: string): string {
  const [iv, tag, body] = value.split(".").map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !body) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
