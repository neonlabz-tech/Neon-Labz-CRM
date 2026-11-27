import Link from "next/link";
import { AlertTriangle, CheckCircle2, ListChecks, Loader } from "lucide-react";
import { Card, PageHeader, Stat } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { addDays, ISO_DATE, todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { MONTHS } from "@/lib/finance";
import { param, type SearchParams } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { Task } from "@/models/task";

export const metadata = { title: "Productivity" };

const RANGES = [["week", "7 days"], ["month", "30 days"], ["year", "12 months"]] as const;

/** Day keys (YYYY-MM-DD) or month keys (YYYY-MM) ending today, oldest first. */
function buckets(range: string, today: string): { key: string; label: string }[] {
  if (range === "year") {
    const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    return Array.from({ length: 12 }, (_, i) => {
      const index = y * 12 + (m - 1) - (11 - i);
      const year = Math.floor(index / 12);
      const month = (index % 12) + 1;
      return { key: `${year}-${String(month).padStart(2, "0")}`, label: `${MONTHS[month - 1]?.slice(0, 3)} ${String(year).slice(2)}` };
    });
  }
  const days = range === "month" ? 30 : 7;
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(today, i - (days - 1));
    return { key, label: range === "month" ? key.slice(8) : key.slice(5) };
  });
}

/** A custom range: one bar a day up to about two months, one bar a month beyond that. */
function customBuckets(from: string, to: string): { key: string; label: string; monthly: boolean }[] {
  const span = Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000) + 1;
  if (span <= 62) return Array.from({ length: span }, (_, i) => { const key = addDays(from, i); return { key, label: key.slice(5), monthly: false }; });
  const out: { key: string; label: string; monthly: boolean }[] = [];
  let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const last = `${to.slice(0, 4)}-${to.slice(5, 7)}`;
  for (let guard = 0; guard < 120; guard++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ key, label: `${MONTHS[m - 1]?.slice(0, 3)} ${String(y).slice(2)}`, monthly: true });
    if (key >= last) break;
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export default async function ProductivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("tasks.work");
  const sp = await searchParams;
  const asked = param(sp, "range");
  const range = asked === "custom" || RANGES.some(([id]) => id === asked) ? asked : "week";
  const today = todayISO();
  let from = today;
  let to = today;
  if (range === "custom") {
    const f = param(sp, "from");
    const t = param(sp, "to");
    from = ISO_DATE.test(f) ? f : addDays(today, -29);
    to = ISO_DATE.test(t) && t <= today ? t : today;
    if (from > to) [from, to] = [to, from];
  }
  const custom = range === "custom" ? customBuckets(from, to) : [];
  const slots: { key: string; label: string }[] = range === "custom" ? custom : buckets(range, today);
  const monthly = range === "year" || Boolean(custom[0]?.monthly);
  const first = slots[0]?.key ?? today;
  const since = new Date(range === "custom" ? `${from}T00:00:00+05:30` : `${monthly ? `${first}-01` : first}T00:00:00+05:30`);
  const until = new Date(range === "custom" ? `${to}T23:59:59.999+05:30` : "2100-01-01T00:00:00Z");

  await connectDb();
  const finished = { $ifNull: ["$completedAt", "$doneAt"] };
  const [perSlot, status, overdue] = await Promise.all([
    Task.aggregate<{ _id: string; n: number }>([
      { $match: { assigneeCode: user.username, status: { $in: ["completed", "waiting", "done"] } } },
      { $addFields: { finishedAt: finished } },
      { $match: { finishedAt: { $gte: since, $lte: until } } },
      { $group: { _id: { $dateToString: { format: monthly ? "%Y-%m" : "%Y-%m-%d", date: "$finishedAt", timezone: "Asia/Colombo" } }, n: { $sum: 1 } } },
    ]),
    Task.aggregate<{ _id: string; n: number }>([{ $match: { assigneeCode: user.username } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Task.countDocuments({ assigneeCode: user.username, status: { $in: ["not-started", "in-progress"] }, dueDate: { $ne: "", $lt: today } }),
  ]);
  const counts = new Map(perSlot.map((r) => [r._id, r.n]));
  const series = slots.map((s) => ({ ...s, n: counts.get(s.key) ?? 0 }));
  const total = series.reduce((sum, s) => sum + s.n, 0);
  const max = Math.max(1, ...series.map((s) => s.n));
  const all = status.reduce((sum, s) => sum + s.n, 0);
  const doing = status.find((s) => s._id === "in-progress")?.n ?? 0;

  return (
    <>
      <PageHeader title="Productivity" subtitle="How much work you have finished.">
        <div className="flex gap-1 rounded-xl bg-brand-50 p-1">
          {RANGES.map(([id, text]) => (
            <Link prefetch={false} key={id} href={`?range=${id}`} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", range === id ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>{text}</Link>
          ))}
          <Link prefetch={false} href="?range=custom" className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", range === "custom" ? "bg-white text-brand-700 shadow-sm" : "text-muted")}>Custom</Link>
        </div>
      </PageHeader>
      {range === "custom" && (
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2 text-sm">
        <input type="hidden" name="range" value="custom" />
        <label className="grid gap-1 text-xs font-medium text-muted">From<input type="date" name="from" defaultValue={from} max={today} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink" /></label>
        <label className="grid gap-1 text-xs font-medium text-muted">To<input type="date" name="to" defaultValue={to} max={today} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink" /></label>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Apply</button>
      </form>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Finished in this period" value={total} icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat label="Currently doing" value={doing} icon={<Loader className="h-5 w-5" />} />
        <Stat label="Overdue" value={overdue} icon={<AlertTriangle className="h-5 w-5" />} />
        <Stat label="All assigned tasks" value={all} icon={<ListChecks className="h-5 w-5" />} />
      </div>
      <Card>
        <h2 className="mb-4 font-semibold">Items completed</h2>
        <div className="flex h-40 items-end gap-1 overflow-x-auto" role="img" aria-label={`${total} tasks finished`}>
          {series.map((s) => (
            <div key={s.key} className="flex min-w-6 flex-1 flex-col items-center justify-end gap-1 text-[11px] text-muted">
              <span>{s.n}</span>
              <i className="brand-gradient w-full rounded-t" style={{ height: `${Math.max(4, Math.round((s.n / max) * 100))}px` }} />
              <span className="whitespace-nowrap">{s.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
