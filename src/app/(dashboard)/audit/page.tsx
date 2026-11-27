import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { formatDateTime } from "@/lib/utils";
import { Audit } from "@/models/audit";

export const metadata = { title: "Activity log" };

const tone = (action: string) => (action.includes("denied") || action.includes("failed") || action.includes("deleted") ? "danger" : action.startsWith("login") ? "info" : "brand");

const LABELS: Record<string, string> = {
  "login.ok": "Signed in", "login.failed": "Sign-in failed", "login.denied": "Sign-in blocked", "logout": "Signed out",
  "payment.approved": "Payment approved", "payment.cancelled": "Payment rejected",
  "project.created": "Project created", "project.updated": "Project updated", "project.archived": "Project moved to history", "project.restored": "Project moved back to active",
};
/** "hrms.employee.created" reads as "Hrms employee created" when there is no hand-written label. */
const readable = (action: string) => LABELS[action] ?? (action.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase()));

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAction("audit.view");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter = { action: { $ne: "stores.saved" }, ...(rx ? { $or: [{ actor: rx }, { action: rx }] } : {}) };

  await connectDb();
  const [rows, total] = await Promise.all([
    Audit.find(filter).sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Audit.countDocuments(filter),
  ]);

  return (
    <>
      <PageHeader title="Activity log" subtitle="Sign-ins, approvals, deletions and blocked actions. Entries are kept for 90 days." />
      <SearchBar q={q} placeholder="Search by person or action" />
      {rows.length === 0 ? (
        <EmptyState title="Nothing here yet" text="Activity will show up as people use the CRM." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {rows.map((row) => (
            <li key={String(row._id)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="flex items-center gap-3"><Badge tone={tone(row.action)}>{readable(row.action)}</Badge><span className="font-semibold">{row.actor}</span></div>
              <span className="text-muted">{formatDateTime(row.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} total={total} query={{ q }} />
    </>
  );
}
