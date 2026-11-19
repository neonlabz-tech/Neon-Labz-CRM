import { ManualSale } from "@/models/manual-sale";

/**
 * Money collected on confirmed manual sales, month by month (key YYYY-MM).
 * Each receipt counts on its own date; an older sale with collected money but no receipt lines counts on the sale date.
 * `date` is the same period filter the other revenue queries use (a regex on the text date), or nothing for all time.
 */
export async function manualCollections(date?: unknown): Promise<{ _id: string; n: number }[]> {
  return ManualSale.aggregate<{ _id: string; n: number }>([
    { $match: { status: "confirmed" } },
    { $project: { lines: { $cond: [{ $gt: [{ $size: { $ifNull: ["$payments", []] } }, 0] }, "$payments", [{ amount: "$collected", date: "$date" }]] } } },
    { $unwind: "$lines" },
    ...(date ? [{ $match: { "lines.date": date } }] : []),
    { $group: { _id: { $substr: ["$lines.date", 0, 7] }, n: { $sum: "$lines.amount" } } },
  ]);
}

export const manualCollected = async (date?: unknown): Promise<number> => (await manualCollections(date)).reduce((sum, row) => sum + row.n, 0);
