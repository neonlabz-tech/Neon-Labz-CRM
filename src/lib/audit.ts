import "server-only";
import { connectDb } from "./db";
import { Audit } from "@/models/audit";

export async function writeAudit(actor: string, action: string, detail: Record<string, unknown> = {}) {
  try {
    await connectDb();
    await Audit.create({ actor, action, detail });
  } catch (error) {
    console.error("Audit write failed", error);
  }
}
