import "server-only";
import { connectDb } from "./db";
import { workTypeOf } from "./work-type";
import { Client } from "@/models/client";
import { Quotation } from "@/models/quotation";

/** Clients saved before work types existed get theirs from what was actually quoted. Runs once per client. */
export async function backfillWorkTypes() {
  await connectDb();
  const old = await Client.find({ workType: null }).select("code leadId service").limit(500).lean();
  if (!old.length) return;
  const quotes = await Quotation.find({ leadId: { $in: old.map((c) => c.leadId) } }).select("leadId items").lean();
  const byLead = new Map(quotes.map((q) => [q.leadId, [...new Set(q.items.map((i) => i.service).filter((v): v is string => !!v))]]));
  await Client.bulkWrite(old.map((c) => {
    const services = byLead.get(c.leadId) ?? [];
    return { updateOne: { filter: { _id: c._id }, update: { $set: { workType: workTypeOf(...(services.length ? services : [c.service])), ...(services.length ? { service: services.join(", ") } : {}) } } } };
  }));
}
