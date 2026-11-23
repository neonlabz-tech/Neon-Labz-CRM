import "server-only";
import { connectDb } from "./db";
import { SpecialClient } from "@/models/special";

/** Every special client, for the "Client" choice in the forms. */
export async function clientOptions() {
  await connectDb();
  const rows = await SpecialClient.find().select("name code").sort({ name: 1 }).lean();
  return rows.map((row) => ({ id: String(row._id), name: row.name, code: row.code }));
}

/** The text fields of a saved form (the lists are read with `listOf`). */
export function stringsOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

/** A saved table (rows of text cells), or nothing. */
export function listOf(value: unknown): Record<string, string>[] {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object").map((row) => stringsOf(row)) : [];
}
