import { BulkLeads } from "@/components/leads/bulk-leads";
import { ImportLeads } from "@/components/leads/import-leads";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Download, PhoneCall, Pencil, Plus, UserPlus, Users } from "lucide-react";
import { AssignLead } from "@/components/leads/assign-lead";
import { CallHistory } from "@/components/leads/call-history";
import { GuestActions } from "@/components/leads/guest-actions";
import { GuestForm } from "@/components/leads/guest-form";
import { LeadForm } from "@/components/leads/lead-form";
import { LeadRowActions } from "@/components/leads/lead-actions";
import { Badge } from "@/components/ui/badge";
import { DialogButton } from "@/components/ui/dialog-button";
import { ColorCard, EmptyState, PageHeader } from "@/components/ui/card";
import { todayISO } from "@/lib/dates";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { keepOwn, ownLeads, ownView, salesLeads } from "@/lib/own";
import { can, ownerScope } from "@/lib/permissions";
import { formatDateTime, formatDay } from "@/lib/utils";
import { dayRange, periodRange } from "@/lib/sales-range";
import { CALL_OUTCOMES, LEAD_SERVICES, LEAD_SOURCES, LEAD_STAGES, Lead } from "@/models/lead";
import { Client } from "@/models/client";
import { ManualSale } from "@/models/manual-sale";
import { Package } from "@/models/package";
import { User } from "@/models/user";

export const metadata = { title: "Leads" };

const GOES_LABEL: Record<string, string> = { project: "Project", marketing: "Marketing", both: "Project + Marketing", own: "Super Admin (own)" };

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
  // Guests are existing clients the Super Admin brought in; they have their own tab and never count as leads.
  const guestView = own && param(sp, "view") === "guest";
  const today = todayISO();
  const { period, picked, range } = periodRange(sp, today);
  const admin = user.role === "superadmin" && !own;
  const canDelete = can(user.role, "leads.delete");

  // Whose leads, and from when. The four cards count within this; the table adds the stage, source and search on top.
  const scope: Record<string, unknown> = { ...ownerScope(user), ...(own ? ownLeads(user.username) : user.role === "superadmin" ? salesLeads(user.username) : {}) };
  if (admin && range.seller) scope.owner = range.seller;
  const created = dayRange(range);
  if (created) scope.date = created;
  const filter: Record<string, unknown> = { ...scope };
  if (LEAD_STAGES.includes(status as never)) filter.status = status;
  if (LEAD_SOURCES.includes(source as never)) filter.source = source;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ business: rx }, { leadId: rx }, { phone: rx }, { clientCode: rx }];
  }

  await connectDb();
  const sellers = user.role === "superadmin" ? await User.find({ role: "sales" }).select("username fullName").sort({ username: 1 }).lean() : [];
  // A lead that is converted or lost no longer needs a follow-up.
  const open: Record<string, unknown> = { status: { $nin: ["Converted", "Lost"] } };
  const [rows, total, everyLead, overdueCount, dueToday, converted] = await Promise.all([
    Lead.find(filter).select("leadId business phone email address businessType source service status next notes clientCode owner createdAt date calls").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Lead.countDocuments(filter),
    Lead.countDocuments(scope),
    Lead.countDocuments({ ...scope, ...open, next: { $gt: "", $lt: today } } as Record<string, unknown>),
    Lead.countDocuments({ ...scope, ...open, next: today } as Record<string, unknown>),
    Lead.countDocuments({ ...scope, status: "Converted" }),
  ]);
  const overdue = (r: (typeof rows)[number]) => Boolean(r.next) && r.next < today && r.status !== "Converted" && r.status !== "Lost";
  const callItems = (r: (typeof rows)[number]) => (r.calls ?? []).map((c, index) => ({ index, outcome: c.outcome, status: c.status, next: c.next ?? "", note: c.note ?? "", when: formatDateTime(c.createdAt) }));

  const Bulk = canDelete ? BulkLeads : Plain;

  const guests = guestView ? await ManualSale.find({ guest: true }).select("saleCode business clientCode service goesTo date createdAt").sort({ createdAt: -1 }).limit(200).lean() : [];
  const guestChoices = own
    ? await Promise.all([Client.find().select("name").sort({ name: 1 }).limit(500).lean(), Package.find({ status: "active" }).select("name category").sort({ name: 1 }).limit(200).lean()])
    : null;
  const tabClass = (on: boolean) => `inline-flex h-10 items-center rounded-xl border px-5 text-sm font-semibold transition-colors ${on ? "brand-gradient border-transparent text-white shadow-sm" : "border-line bg-white text-ink hover:border-brand-300 hover:bg-brand-50"}`;

  return (
    <>
      <PageHeader title="Leads" subtitle={user.role === "sales" || own ? "Your leads and follow-ups." : "Every lead across the sales team."}>
        <div className="flex flex-wrap gap-2">
        {canDelete && <ImportLeads today={today} sources={[...LEAD_SOURCES]} services={[...LEAD_SERVICES]} stages={[...LEAD_STAGES]} sellers={sellers.map((u) => ({ username: u.username, label: u.fullName || u.username }))} />}
        {can(user.role, "leads.export") && <a href={`/leads/export?${new URLSearchParams({ q, status, source, period, from: picked.from, to: picked.to, seller: range.seller, ...keepOwn(own) })}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-brand-50"><Download className="h-4 w-4" />Export CSV</a>}
        {guestChoices && (
          <DialogButton label="Add guest" title="Add guest client" subtitle="An existing client with a running project" headerIcon={<UserPlus className="h-5 w-5" />} trigger={<span className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm hover:brightness-110"><UserPlus className="h-4 w-4" />Add guest</span>}>
            <GuestForm
              today={today}
              clients={guestChoices[0].map((c) => c.name)}
              services={guestChoices[1].map((p) => p.name)}
              categories={Object.fromEntries(guestChoices[1].map((p) => [p.name.toLowerCase(), p.category]))}
            />
          </DialogButton>
        )}
        <Link prefetch={false} href={own ? "/leads/new?own=1" : "/leads/new"} className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add lead</Link>
        </div>
      </PageHeader>
      {own && (
        <div className="mb-4 flex gap-2">
          <Link prefetch={false} href="/leads?own=1" className={tabClass(!guestView)}>Leads</Link>
          <Link prefetch={false} href="/leads?own=1&view=guest" className={tabClass(guestView)}>Guest</Link>
        </div>
      )}
      {guestView ? (
        guests.length === 0 ? (
          <EmptyState title="No guest clients yet" text="Use Add guest for an existing client who already has a running project." />
        ) : (
          <DataTable
            rows={guests}
            rowKey={(r) => r.saleCode}
            columns={[
              { header: "#", cell: (r) => guests.findIndex((x) => x.saleCode === r.saleCode) + 1 },
              { header: "Client", cell: (r) => <span className="block"><span className="font-semibold">{r.business}</span>{r.clientCode && <span className="mt-1 block text-xs text-muted">{r.clientCode}</span>}</span> },
              { header: "Service or package", cell: (r) => <span className="block max-w-72 whitespace-normal">{r.service}</span> },
              { header: "Goes to", cell: (r) => GOES_LABEL[r.goesTo ?? "project"] ?? r.goesTo },
              { header: "Old project date", cell: (r) => formatDay(r.date) },
              { header: "Status", cell: () => <Badge tone="info">Guest</Badge> },
              { header: "Actions", cell: (r) => <GuestActions id={String(r._id)} /> },
            ]}
          />
        )
      ) : (
        <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ColorCard tone={0} label="Leads" value={everyLead} icon={<Users className="h-5 w-5" />} />
        <ColorCard tone={2} label="Overdue" value={overdueCount} hint="Follow-up date has passed" icon={<AlertTriangle className="h-5 w-5" />} />
        <ColorCard tone={1} label="Due Today" value={dueToday} icon={<CalendarClock className="h-5 w-5" />} />
        <ColorCard tone={3} label="Converted" value={converted} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>
      <SearchBar q={q} keep={keepOwn(own)} placeholder="Search by name, lead ID, phone or client code" range={picked} filters={[{ name: "status", label: "All stages", value: status, options: LEAD_STAGES.map((s) => ({ value: s, label: s })) }, { name: "source", label: "All sources", value: source, options: LEAD_SOURCES.map((s) => ({ value: s, label: s })) }, ...(admin ? [{ name: "seller", label: "All salespeople", value: range.seller, options: sellers.map((u) => ({ value: u.username, label: u.fullName || u.username })) }] : [])]} />
      {rows.length === 0 ? (
        <EmptyState title="No leads found" text="Add a lead, or change your search." />
      ) : (
        <Bulk key={rows.map((r) => r.leadId).join(",")}><DataTable
          rows={rows}
          rowKey={(r) => r.leadId}
          compact
          stickyLast
          rowClass={(r) => (overdue(r) ? "bg-danger-soft hover:bg-danger-soft" : undefined)}
          columns={[
            ...(canDelete ? [{ header: "", cell: (r: (typeof rows)[number]) => <input type="checkbox" data-lead={r.leadId} aria-label={`Select ${r.business}`} className="h-4 w-4 shrink-0 accent-brand-600" /> }] : []),
            { header: "#", cell: (r) => skipOf(page) + rows.findIndex((x) => x.leadId === r.leadId) + 1 },
            { header: "Lead ID", cell: (r) => (
              <span className="block">
                <DialogButton label={`Edit ${r.leadId}`} title={r.business} subtitle={r.leadId} headerIcon={<Pencil className="h-5 w-5" />} trigger={<span className="rounded-md bg-brand-50 px-2 py-1 font-semibold text-brand-700">{r.leadId}</span>}>
                  <LeadForm uid={r.leadId} defaults={{ id: r.leadId, date: r.date, business: r.business, phone: r.phone, email: r.email, address: r.address, businessType: r.businessType, source: r.source, service: r.service, status: r.status, notes: r.notes }} />
                </DialogButton>
                {r.clientCode && <span className="mt-1 block text-xs text-muted">{r.clientCode}</span>}
              </span>
            ) },
            { header: "Phone / Customer", cell: (r) => <span className="block min-w-36 max-w-60 whitespace-normal"><span className="block font-semibold">{r.phone || "—"}</span><span className="block text-xs text-muted">{r.business}</span></span> },
            { header: "Date added", cell: (r) => <span className="whitespace-normal">{r.date ? formatDay(r.date) : formatDateTime(r.createdAt)}</span> },
            { header: "Source", cell: (r) => <span className="whitespace-normal">{r.source}</span> },
            { header: "Status", cell: (r) => <Badge tone={tone(r.status)}>{r.status}</Badge> },
            { header: "Call status", cell: (r) => { const last = r.calls?.at(-1); return last ? <Badge tone={last.outcome === "Answered" ? "success" : "warning"}>{last.outcome}</Badge> : "—"; } },
            { header: "Next follow-up", cell: (r) => (!r.next ? "—" : overdue(r) ? <Badge tone="danger">Overdue · {r.next}</Badge> : r.next === today && r.status !== "Converted" && r.status !== "Lost" ? <Badge tone="warning">Today</Badge> : <span>{r.next}</span>) },
            { header: "Follow-ups", cell: (r) => <span className="font-semibold">{r.calls?.length ?? 0}</span> },
            ...(user.role === "superadmin" ? [{ header: "Person", cell: (r: (typeof rows)[number]) => (own ? r.owner : <AssignLead id={r.leadId} owner={r.owner} sellers={sellers.map((u) => ({ username: u.username, label: u.fullName || u.username }))} />) }] : []),
            { header: "Actions", cell: (r) => (
              <LeadRowActions id={r.leadId} canDelete={canDelete} canQuote={can(user.role, "quotations.manage") && r.status !== "Lost"}>
                <DialogButton label={`Follow-ups (${r.calls?.length ?? 0})`} title="Call history" subtitle={`${r.leadId} · ${r.business}`} icon={<PhoneCall className="h-4 w-4" />} headerIcon={<PhoneCall className="h-5 w-5" />}>
                  <CallHistory leadId={r.leadId} stage={r.status} today={today} outcomes={[...CALL_OUTCOMES]} stages={[...LEAD_STAGES]} calls={callItems(r)} />
                </DialogButton>
              </LeadRowActions>
            ) },
          ]}
        /></Bulk>
      )}
      <Pagination page={page} total={total} query={{ q, status, source, period, from: picked.from, to: picked.to, seller: range.seller, ...keepOwn(own) }} />
        </>
      )}
    </>
  );
}
