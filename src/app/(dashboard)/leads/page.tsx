import { BulkLeads } from "@/components/leads/bulk-leads";
import { ImportLeads } from "@/components/leads/import-leads";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { AssignLead } from "@/components/leads/assign-lead";
import { LeadRowActions } from "@/components/leads/lead-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { todayISO } from "@/lib/dates";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { keepOwn, ownView } from "@/lib/own";
import { can, ownerScope } from "@/lib/permissions";
import { formatDateTime, formatDay } from "@/lib/utils";
import { dayRange, periodRange } from "@/lib/sales-range";
import { LEAD_SERVICES, LEAD_SOURCES, LEAD_STAGES, Lead } from "@/models/lead";
import { User } from "@/models/user";

export const metadata = { title: "Leads" };

const tone = (status: string) => (status === "Converted" ? "success" : status === "Lost" ? "danger" : status === "New" ? "info" : "brand");

/** The table as it is, for people who cannot delete leads and so have no ticks. */
const Plain = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("leads.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const status = param(sp, "status");
  const source = param(sp, "source");
  const page = pageOf(sp);
  const own = ownView(user.role, sp);
  const today = todayISO();
  const { period, picked, range } = periodRange(sp, today);
  const admin = user.role === "superadmin" && !own;
  const canDelete = can(user.role, "leads.delete");

  const filter: Record<string, unknown> = { ...ownerScope(user), ...(own ? { owner: user.username } : {}) };
  if (LEAD_STAGES.includes(status as never)) filter.status = status;
  if (LEAD_SOURCES.includes(source as never)) filter.source = source;
  if (admin && range.seller) filter.owner = range.seller;
  const created = dayRange(range);
  if (created) filter.date = created;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ business: rx }, { leadId: rx }, { phone: rx }, { clientCode: rx }];
  }

  await connectDb();
  const sellers = user.role === "superadmin" ? await User.find({ role: "sales" }).select("username fullName").sort({ username: 1 }).lean() : [];
  const [rows, total] = await Promise.all([
    Lead.find(filter).select("leadId business phone source status next clientCode owner createdAt date calls.outcome").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Lead.countDocuments(filter),
  ]);

  const Bulk = canDelete ? BulkLeads : Plain;

  return (
    <>
      <PageHeader title="Leads" subtitle={user.role === "sales" || own ? "Your leads and follow-ups." : "Every lead across the sales team."}>
        <div className="flex flex-wrap gap-2">
        {canDelete && <ImportLeads today={today} sources={[...LEAD_SOURCES]} services={[...LEAD_SERVICES]} stages={[...LEAD_STAGES]} sellers={sellers.map((u) => ({ username: u.username, label: u.fullName || u.username }))} />}
        {can(user.role, "leads.export") && <a href={`/leads/export?${new URLSearchParams({ q, status, source, period, from: picked.from, to: picked.to, seller: range.seller, ...keepOwn(own) })}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-brand-50"><Download className="h-4 w-4" />Export CSV</a>}
        <Link prefetch={false} href={own ? "/leads/new?own=1" : "/leads/new"} className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add lead</Link>
        </div>
      </PageHeader>
      <SearchBar q={q} keep={keepOwn(own)} placeholder="Search by name, lead ID, phone or client code" range={picked} filters={[{ name: "status", label: "All stages", value: status, options: LEAD_STAGES.map((s) => ({ value: s, label: s })) }, { name: "source", label: "All sources", value: source, options: LEAD_SOURCES.map((s) => ({ value: s, label: s })) }, ...(admin ? [{ name: "seller", label: "All salespeople", value: range.seller, options: sellers.map((u) => ({ value: u.username, label: u.fullName || u.username })) }] : [])]} />
      {rows.length === 0 ? (
        <EmptyState title="No leads found" text="Add a lead, or change your search." />
      ) : (
        <Bulk key={rows.map((r) => r.leadId).join(",")}><DataTable
          rows={rows}
          rowHref={(r) => `/leads/${r.leadId}`}
          rowKey={(r) => r.leadId}
          columns={[
            ...(canDelete ? [{ header: "", cell: (r: (typeof rows)[number]) => <input type="checkbox" data-lead={r.leadId} aria-label={`Select ${r.business}`} className="h-4 w-4 shrink-0 accent-brand-600" /> }] : []),
            { header: "#", cell: (r) => skipOf(page) + rows.findIndex((x) => x.leadId === r.leadId) + 1 },
            { header: "Lead ID", cell: (r) => <span className="block"><span className="rounded-md bg-brand-50 px-2 py-1 font-semibold text-brand-700">{r.leadId}</span>{r.clientCode && <span className="mt-1 block text-xs text-muted">{r.clientCode}</span>}</span> },
            { header: "Phone / Customer", cell: (r) => <span className="block min-w-44 max-w-72 whitespace-normal"><span className="block font-semibold">{r.phone || "—"}</span><span className="block text-xs text-muted">{r.business}</span></span> },
            { header: "Date added", cell: (r) => <span className="whitespace-normal">{r.date ? formatDay(r.date) : formatDateTime(r.createdAt)}</span> },
            { header: "Source", cell: (r) => <span className="whitespace-normal">{r.source}</span> },
            { header: "Status", cell: (r) => <Badge tone={tone(r.status)}>{r.status}</Badge> },
            { header: "Call status", cell: (r) => { const last = r.calls?.at(-1); return last ? <Badge tone={last.outcome === "Answered" ? "success" : "warning"}>{last.outcome}</Badge> : "—"; } },
            { header: "Next follow-up", cell: (r) => (r.next ? <span className={r.next < today ? "font-semibold text-danger" : ""}>{r.next}</span> : "—") },
            { header: "Follow-ups", cell: (r) => <span className="font-semibold">{r.calls?.length ?? 0}</span> },
            ...(user.role === "superadmin" ? [{ header: "Person", cell: (r: (typeof rows)[number]) => (own ? r.owner : <AssignLead id={r.leadId} owner={r.owner} sellers={sellers.map((u) => ({ username: u.username, label: u.fullName || u.username }))} />) }] : []),
            { header: "Actions", cell: (r) => <LeadRowActions id={r.leadId} canDelete={canDelete} canQuote={can(user.role, "quotations.manage") && r.status !== "Lost"} /> },
          ]}
        /></Bulk>
      )}
      <Pagination page={page} total={total} query={{ q, status, source, period, from: picked.from, to: picked.to, seller: range.seller, ...keepOwn(own) }} />
    </>
  );
}
