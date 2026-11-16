import "server-only";
import { Payment } from "@/models/payment";

/** Total of all payments on a quotation that are not cancelled, pending ones included. */
export async function reservedAmount(quoteId: unknown, exceptId?: unknown): Promise<number> {
  const match: Record<string, unknown> = { quoteId, status: { $ne: "cancelled" } };
  if (exceptId) match._id = { $ne: exceptId };
  const rows = await Payment.aggregate<{ sum: number }>([{ $match: match }, { $group: { _id: null, sum: { $sum: "$amount" } } }]);
  return rows[0]?.sum ?? 0;
}
