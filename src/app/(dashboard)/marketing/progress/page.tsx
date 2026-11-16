import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DialogButton } from "@/components/ui/dialog-button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { PROJECT_STATUS, statusFor } from "@/lib/projects";
import { Milestone } from "@/models/milestone";
import { Project } from "@/models/project";
import { Task } from "@/models/task";

export const metadata = { title: "Marketing progress" };

/** The Project Manager's read-only look at how the marketing side of each project is going. Nothing can be changed from here. */
export default async function MarketingProgressPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("marketing.monitor");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter: Record<string, unknown> = { type: { $in: ["marketing", "both"] }, archived: false, ...(rx ? { $or: [{ name: rx }, { code: rx }, { clientName: rx }] } : {}) };

  await connectDb();
  const [rows, total] = await Promise.all([
    Project.find(filter).select("code name clientName type status softwareStatus marketingStatus dueDate").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Project.countDocuments(filter),
  ]);
  const ids = rows.map((r) => r._id);
  const [milestones, tasks] = await Promise.all([
    Milestone.find({ projectId: { $in: ids }, department: "marketing" }).select("projectId status").lean(),
    Task.find({ projectId: { $in: ids }, department: "marketing" }).select("projectId status").lean(),
  ]);
  const count = <T extends { projectId: unknown; status: string }>(list: T[], id: unknown) => {
    const mine = list.filter((x) => String(x.projectId) === String(id));
    return { done: mine.filter((x) => x.status === "done").length, total: mine.length };
  };

  return (
    <>
      <PageHeader title="Marketing progress" subtitle="How the marketing side of each project is going. View only." />
      <SearchBar q={q} placeholder="Search by project, code or client" />
      {rows.length === 0 ? <EmptyState title="No marketing projects" text="Projects with a marketing part will appear here." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Project", cell: (r) => <span><strong>{r.name}</strong><span className="block text-xs font-normal text-muted">{r.code}</span></span> },
            { header: "Client", cell: (r) => r.clientName },
            { header: "Type", cell: (r) => (r.type === "both" ? "Both (marketing part)" : "Marketing") },
            { header: "Status", cell: (r) => { const shown = statusFor("marketing", r); return <Badge tone={shown === "completed" ? "success" : shown === "on-hold" ? "warning" : "info"}>{PROJECT_STATUS[shown as keyof typeof PROJECT_STATUS]}</Badge>; } },
            {
              header: "Progress",
              cell: (r) => {
                const t = count(tasks, r._id);
                const percent = t.total ? Math.round((t.done / t.total) * 100) : 0;
                return (
                  <div className="min-w-32" title={`${t.done} of ${t.total} tasks done`}>
                    <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{t.total ? `${t.done}/${t.total} tasks` : "No tasks"}</span><strong>{percent}%</strong></div>
                    <div className="h-2 overflow-hidden rounded-full bg-brand-50" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Marketing progress">
                      <div className="brand-gradient h-full rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              },
            },
            { header: "Milestones", cell: (r) => { const m = count(milestones, r._id); return m.total ? `${m.done}/${m.total} done` : "None yet"; } },
            { header: "Due", cell: (r) => r.dueDate || "—" },
            {
              header: "Actions",
              cell: (r) => {
                const t = count(tasks, r._id);
                const m = count(milestones, r._id);
                const shown = statusFor("marketing", r);
                return (
                  <DialogButton label="View progress" title={r.name} subtitle={r.code} icon={<Eye className="h-4 w-4" />}>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      {([
                        ["Client", r.clientName],
                        ["Type", r.type === "both" ? "Both (marketing part)" : "Marketing"],
                        ["Status", PROJECT_STATUS[shown as keyof typeof PROJECT_STATUS]],
                        ["Due", r.dueDate || "—"],
                        ["Marketing tasks", t.total ? `${t.done} of ${t.total} done` : "No tasks"],
                        ["Milestones", m.total ? `${m.done} of ${m.total} done` : "None yet"],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-line bg-canvas px-3 py-2.5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>
                      ))}
                    </dl>
                  </DialogButton>
                );
              },
            },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q }} />
    </>
  );
}
