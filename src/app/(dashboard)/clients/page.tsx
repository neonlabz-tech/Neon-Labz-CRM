import { Download, Eye, Pencil } from "lucide-react";
import Image from "next/image";
import { ContactsForm } from "@/components/clients/contacts-form";
import { DialogButton } from "@/components/ui/dialog-button";
import Link from "next/link";
import { ClientLogo } from "@/components/clients/logo-form";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { keepOwn, ownView } from "@/lib/own";
import { requireAction } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { formatDateTime } from "@/lib/utils";
import { backfillWorkTypes } from "@/lib/client-work";
import { visibleProjectFilter } from "@/lib/project-access";
import { clientWorkFilter, workTypeOfClient } from "@/lib/work-type";
import { Client } from "@/models/client";
import { Project } from "@/models/project";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("clients.view");
  const startProjects = can(user.role, "projects.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const own = ownView(user.role, sp);
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  await connectDb();
  const byProject = rx ? await Project.find({ name: rx }).distinct("clientCode") : [];
  const filter = { $and: [clientWorkFilter(user.role), ...(rx ? [{ $or: [{ name: rx }, { code: rx }, { phone: rx }, { email: rx }, { service: rx }, { address: rx }, { contactName: rx }, { assignedPerson: rx }, { notes: rx }, { code: { $in: byProject } }] }] : []), ...(own ? [{ salesOwner: user.username }] : [{ ownOnly: { $ne: true } }])] };

  await backfillWorkTypes();
  await connectDb();
  const [rows, total] = await Promise.all([
    Client.find(filter).select("code name email phone address service workType logo approvedAt contactName contactTitle assignedPerson notes subContacts").sort({ approvedAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Client.countDocuments(filter),
  ]);
  const projects = await Project.find({ ...(await visibleProjectFilter(user)), clientCode: { $in: rows.map((r) => r.code) }, archived: false }).select("clientCode code name").lean();
  const projectOf = (clientCode: string) => projects.find((p) => p.clientCode === clientCode);

  const clientView = (r: (typeof rows)[number], trigger?: React.ReactNode) => (
    <DialogButton label="View client" title={r.name} subtitle={r.code} icon={trigger ? undefined : <Eye className="h-4 w-4" />} trigger={trigger}>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  {r.logo && (
                    <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5 sm:col-span-2">
                      <Image src={r.logo} alt={`${r.name} logo`} width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-lg border border-line bg-white object-contain" />
                      <a href={r.logo} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><Download className="h-4 w-4" />Download logo</a>
                    </div>
                  )}
                  {([
                    ["Client", `${r.name} · ${r.code}`],
                    ["Service", r.service],
                    ["Work", { software: "Software", marketing: "Marketing", both: "Software + marketing" }[workTypeOfClient(r)]],
                    ["Main person", [r.contactName, r.contactTitle].filter(Boolean).join(" · ")],
                    ["Assigned person", r.assignedPerson],
                    ["Email", r.email],
                    ["Phone", r.phone],
                    ["Address", r.address],
                    ["Approved", formatDateTime(r.approvedAt)],
                    ["Project", projectOf(r.code) ? `${projectOf(r.code)!.name} · ${projectOf(r.code)!.code}` : ""],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-line bg-canvas px-3 py-2.5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 font-medium">{value || "—"}</dd></div>
                  ))}
                  {r.notes && <div className="rounded-xl bg-canvas px-4 py-3 sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Notes</dt><dd className="mt-1 whitespace-pre-line">{r.notes}</dd></div>}
                  {r.subContacts.length > 0 && (
                    <div className="sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Sub contacts</dt>
                      <dd className="mt-1 space-y-1.5">{r.subContacts.map((c, i) => <p key={i} className="rounded-xl border border-line px-3 py-2">{[c.name, c.title, c.email, c.phone].filter(Boolean).join(" · ")}</p>)}</dd>
                    </div>
                  )}
                </dl>
              </DialogButton>
  );

  return (
    <>
      <PageHeader title="Clients" subtitle="Clients whose first payment was approved. Projects are started from here." />
      <SearchBar q={q} keep={keepOwn(own)} placeholder="Search by name, code, phone, email, service or project" />
      {rows.length === 0 ? (
        <EmptyState title="No clients yet" text="A client shows up here once the Super Admin approves their payment." />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.code}
          columns={[
            { header: "Logo", cell: (r) => <div className="font-normal"><ClientLogo code={r.code} name={r.name} logo={r.logo} /></div> },
            { header: "Project", cell: (r: (typeof rows)[number]) => {
              const project = projectOf(r.code);
              const title = project
                ? clientView(r, project.name)
                : startProjects ? <Link prefetch={false} href={`/projects/new?client=${r.code}${own ? "&own=1" : ""}`} className="font-semibold text-brand-700 hover:underline">Start project</Link> : <span className="text-muted">No project yet</span>;
              return <div>{title}<div className="mt-1 font-normal text-muted">{r.name} · {r.code}</div></div>;
            } },
            { header: "Contact", cell: (r) => (r.contactName ? `${r.contactName}${r.contactTitle ? ` · ${r.contactTitle}` : ""}${r.subContacts.length ? ` (+${r.subContacts.length})` : ""}` : "—") },
            { header: "Service", cell: (r) => r.service || "—" },
            { header: "Work", cell: (r) => ({ software: "Software", marketing: "Marketing", both: "Software + marketing" }[workTypeOfClient(r)]) },
            { header: "Phone", cell: (r) => r.phone || "—" },
            { header: "Email", cell: (r) => r.email || "—" },
            { header: "Approved", cell: (r) => formatDateTime(r.approvedAt) },
            { header: "Actions", cell: (r: (typeof rows)[number]) => (
              <div className="flex items-center gap-1">
              {clientView(r)}
              <DialogButton label="Edit client" title={`${r.name} · edit`} icon={<Pencil />} headerIcon={<Pencil className="h-5 w-5" />}>
                <ContactsForm logo={r.logo ?? ""} canSetWork={user.role === "superadmin" || user.role === "pm"} values={{ code: r.code, name: r.name, service: r.service ?? "", workType: workTypeOfClient(r), contactName: r.contactName, contactTitle: r.contactTitle, assignedPerson: r.assignedPerson, email: r.email, phone: r.phone, address: r.address, notes: r.notes, subContacts: r.subContacts.map((p) => ({ name: p.name ?? "", title: p.title ?? "", email: p.email ?? "", phone: p.phone ?? "" })) }} />
              </DialogButton>
              </div>
            ) },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, ...keepOwn(own) }} />
    </>
  );
}
