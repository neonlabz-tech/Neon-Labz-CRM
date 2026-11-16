import { ArrowRight } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/list-controls";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { pageOf, limitOf, skipOf, type SearchParams } from "@/lib/pagination";
import { TASK_STATUS, type TaskStatus } from "@/lib/projects";
import { formatDateTime } from "@/lib/utils";
import { Audit } from "@/models/audit";

export const metadata = { title: "My activity" };

type Detail = { task?: string; project?: string; milestone?: string; from?: string; to?: string };
const label = (status?: string) => TASK_STATUS[status as TaskStatus] ?? status ?? "";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("tasks.work");
  const page = pageOf(await searchParams);
  const filter = { actor: user.username, action: "task.status" };
  await connectDb();
  const [rows, total] = await Promise.all([
    Audit.find(filter).select("detail createdAt").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Audit.countDocuments(filter),
  ]);

  return (
    <>
      <PageHeader title="My activity" subtitle="Every time you moved a task, newest first." />
      {rows.length === 0 ? <EmptyState title="Nothing yet" text="Move a task on a project board and it shows up here." /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {rows.map((row) => {
            const d = row.detail as Detail;
            return (
              <li key={String(row._id)} className="px-4 py-3 text-sm">
                <p className="font-semibold">{d.task}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-muted">
                  {label(d.from)}<ArrowRight className="h-3.5 w-3.5" /><span className="font-semibold text-ink">{label(d.to)}</span>
                  <span>· {d.project}{d.milestone ? ` · ${d.milestone}` : ""} · {formatDateTime(row.createdAt)}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} total={total} query={{}} />
    </>
  );
}
