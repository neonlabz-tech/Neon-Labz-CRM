import "server-only";
import { Counter } from "@/models/counter";
import { connectDb } from "./db";

export async function nextSeq(key: string): Promise<number> {
  await connectDb();
  const row = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return row?.seq ?? 1;
}

/** The number the next nextSeq(key) will return, without using it. Shown as a preview; another save in between can take it. */
export async function peekSeq(key: string): Promise<number> {
  await connectDb();
  const row = await Counter.findById(key).lean();
  return (row?.seq ?? 0) + 1;
}

export { clientCode, issueCode, leadId, manualSaleCode, projectCode, quoteNumber, saleCode, taskCode } from "./counters-format";
