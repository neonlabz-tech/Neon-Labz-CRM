import { dateIn } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { periodTarget } from "@/lib/sales-targets";
import { Payment } from "@/models/payment";
import { SalesTarget } from "@/models/sales-target";
import { User } from "@/models/user";
import { Panel } from "./widgets";

/** Up to this many salespeople are shown as cards; more than this becomes a table. */
const CARD_LIMIT = 6;

type Row = { username: string; name: string; got: number; target: number; percent: number };

function Bar({ percent }: { percent: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-brand-50" aria-hidden="true"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, percent)}%` }} /></div>;
}

const Status = ({ row }: { row: Row }) =>
  !row.target ? <span className="text-xs font-semibold text-muted">Target not fixed</span>
    : row.percent >= 100 ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Target achieved · {row.percent}%</span>
    : <b className="text-ink">{row.percent}%</b>;

/** Company-wide collections against each salesperson's target, best first. */
export async function TeamRanking({ year, month, prefix }: { year: string; month: string; prefix: string }) {
  const [staff, names, collected] = await Promise.all([
    User.find({ role: "sales", active: true }).select("username fullName").limit(200).lean(),
    SalesTarget.find().select("username name target").lean(),
    Payment.aggregate<{ _id: string; n: number }>([{ $match: { status: "confirmed", ...dateIn(prefix, "date") } }, { $group: { _id: "$owner", n: { $sum: "$amount" } } }]),
  ]);
  const label = new Map(names.map((n) => [n.username, n.name]));
  const money = new Map(collected.map((r) => [r._id, r.n]));
  const fixed = new Map(names.map((n) => [n.username, n.target ?? 0]));
  const rows: Row[] = staff.map((u) => {
    const target = periodTarget(fixed.get(u.username) ?? 0, year, month);
    const got = money.get(u.username) ?? 0;
    return { username: u.username, name: u.fullName || label.get(u.username) || u.username, got, target, percent: target ? Math.round((100 * got) / target) : 0 };
  }).sort((a, b) => b.got - a.got);

  return (
    <Panel title="Sales team ranking" empty={rows.length ? undefined : "No sales team yet."}>
      {rows.length > 0 && rows.length <= CARD_LIMIT && (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row, index) => (
            <li key={row.username} className="rounded-2xl border border-line bg-[#F1E8FF] p-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{index + 1}</span>
                <div className="min-w-0"><p className="truncate font-semibold">{row.name}</p><p className="truncate text-xs text-muted">{row.username}</p></div>
              </div>
              <p className="mt-3 text-lg font-bold">{formatMoney(row.got)}</p>
              <p className="mb-2 text-xs text-muted">{row.target ? `of ${formatMoney(row.target)} target` : "Target not fixed"}</p>
              {row.target > 0 && <Bar percent={row.percent} />}
              <div className="mt-2"><Status row={row} /></div>
            </li>
          ))}
        </ol>
      )}
      {rows.length > CARD_LIMIT && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-3">Rank</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3 text-right">Collected</th><th className="py-2 pr-3 text-right">Target</th><th className="py-2 pr-3">Progress</th></tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.username} className="border-b border-line/60 last:border-0">
                  <td className="py-2 pr-3 font-semibold">{index + 1}</td>
                  <td className="py-2 pr-3"><span className="font-medium">{row.name}</span> <span className="text-xs text-muted">{row.username}</span></td>
                  <td className="py-2 pr-3 text-right">{formatMoney(row.got)}</td>
                  <td className="py-2 pr-3 text-right">{row.target ? formatMoney(row.target) : "Not fixed"}</td>
                  <td className="py-2 pr-3"><div className="flex items-center gap-2"><div className="w-24"><Bar percent={row.percent} /></div><Status row={row} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
