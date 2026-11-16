import Link from "next/link";
import { AlertTriangle, CheckCircle2, ListChecks, Loader } from "lucide-react";
import { Card, PageHeader, Stat } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";
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

export default async function ProductivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("tasks.work");
  const asked = param(await searchParams, "range");
  const range = RANGES.some(([id]) => id === asked) ? asked : "week";
  const today = todayISO();
  const slots = buckets(range, today);
  const monthly = range === "year";
  const first = slots[0]?.key ?? today;
  const since = new Date(`${monthly ? `${first}-01` : first}T00:00:00+05:30`);

  await connectDb();
  const finished = { $ifNull: ["$completedAt", "$doneAt"] };
  const [perSlot, status, overdue] = await Promise.all([
    Task.aggregate<{ _id: string; n: number }>([
      { $match: { assigneeCode: user.username, status: { $in: ["completed", "done"] } } },
      { $addFields: { finishedAt: finished } },
      { $match: { finishedAt: { $gte: since } } },
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
        </div>
      </PageHeader>
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
