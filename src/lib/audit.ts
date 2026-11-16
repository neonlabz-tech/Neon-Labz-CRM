import "server-only";
import { after } from "next/server";
import { connectDb } from "./db";
import { Audit } from "@/models/audit";

async function write(actor: string, action: string, detail: Record<string, unknown>) {
  try {
    await connectDb();
    await Audit.create({ actor, action, detail });
  } catch (error) {
    console.error("Audit write failed", error);
  }
}

/** The log entry is saved after the response has gone out, so a button never waits for it. Outside a request it is saved straight away. */
export async function writeAudit(actor: string, action: string, detail: Record<string, unknown> = {}) {
  try {
    after(() => write(actor, action, detail));
  } catch {
    await write(actor, action, detail);
  }
}
