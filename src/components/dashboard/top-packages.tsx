import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { dateIn } from "@/lib/dashboard";
import { Payment } from "@/models/payment";
import { Quotation } from "@/models/quotation";

type Rank = { name: string; quoted: number; sold: number };

/**
 * The packages this salesperson quotes most, ranked. "Quoted" counts every quotation that has the package in it;
 * "Sold" counts those quotations that have at least one approved payment.
 */
export async function TopPackages({ owner, prefix }: { owner?: string; prefix: string }) {
  const mine = owner ? { owner } : {};
  const [quotes, paid] = await Promise.all([
    Quotation.find({ ...mine, ...dateIn(prefix, "date") }).select("items.packageName").lean(),
    Payment.distinct("quoteId", { ...mine, status: "confirmed" }),
  ]);
  const paidIds = new Set(paid.map(String));
  const table = new Map<string, Rank>();
  for (const quote of quotes) {
    const names = new Set(quote.items.map((item) => item.packageName));
    for (const name of names) {
      const row = table.get(name) ?? { name, quoted: 0, sold: 0 };
      row.quoted += 1;
      if (paidIds.has(String(quote._id))) row.sold += 1;
      table.set(name, row);
    }
  }
  const ranked = [...table.values()].sort((a, b) => b.sold - a.sold || b.quoted - a.quoted || a.name.localeCompare(b.name)).slice(0, 6);
  const most = Math.max(1, ...ranked.map((r) => r.quoted));
  const medal = ["bg-[#873CFF] text-white", "bg-[#B58CFF] text-white", "bg-[#D9C2FF] text-brand-700"];
  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-brand-600" />Top packages</h2>
      <p className="mb-3 text-xs text-muted">{owner ? "Ranked by sales, then by how often you quote them." : "Ranked by sales, then by how often the team quotes them."}</p>
      {ranked.length === 0 ? (
        <p className="text-sm text-muted">Packages you add to quotations are ranked here.</p>
      ) : (
        <ol className="space-y-3">
          {ranked.map((row, index) => (
            <li key={row.name}>
              <div className="flex items-center gap-3">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${medal[index] ?? "bg-brand-50 text-brand-700"}`}>{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                <span className="shrink-0 text-xs text-muted"><b className="text-ink">{row.sold}</b> sold · {row.quoted} quoted</span>
              </div>
              <div className="ml-10 mt-1.5 h-2 overflow-hidden rounded-full bg-brand-50">
                <div className="h-full rounded-full bg-gradient-to-r from-[#873CFF] to-[#E04FD8]" style={{ width: `${Math.round((100 * row.quoted) / most)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
