import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

/** Writes every collection to one JSON file in ./backups. Run with `yarn backup`. */
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set.");
await mongoose.connect(uri);
const db = mongoose.connection.db;
if (!db) throw new Error("No database connection.");
const out: Record<string, unknown[]> = {};
for (const { name } of await db.listCollections().toArray()) out[name] = await db.collection(name).find().toArray();
const folder = path.join(process.cwd(), "backups");
await fs.mkdir(folder, { recursive: true });
const file = path.join(folder, `neon-crm-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await fs.writeFile(file, JSON.stringify({ at: new Date().toISOString(), collections: out }, null, 2), "utf8");
await mongoose.disconnect();
console.log(`Backup written to ${file}`);
