import Link from "next/link";
import { Flag, Pencil, Plus } from "lucide-react";
import { AccessBar } from "@/components/projects/access-bar";
import { Kpis } from "@/components/dashboard/widgets";
import { ProjectView } from "@/components/projects/project-view";
import { MilestonesBoard } from "@/components/projects/milestones-board";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DialogButton } from "@/components/ui/dialog-button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { keepOwn, ownView } from "@/lib/own";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { accountFilter, activeEmployees, marketingUsernames, visibleProjectFilter } from "@/lib/project-access";
import { canEditProjectShell, canManageDepartment, PROJECT_STATUS, PROJECT_TYPES, partsLine, statusFor, type Department, type ProjectType } from "@/lib/projects";
import { formatDay } from "@/lib/utils";
import { Lead } from "@/models/lead";
import { Milestone } from "@/models/milestone";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { User } from "@/models/user";
import { updateProjectAction } from "@/server/project-actions";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("projects.view");
  const sp = await searchParams;
  const q = param(sp, "q");
  const type = param(sp, "type");
  const status = param(sp, "status");
  const showArchived = param(sp, "archived") === "1";
  const page = pageOf(sp);
  const own = ownView(user.role, sp);
  const pm = param(sp, "pm");
  const admin = user.role === "superadmin";
  const viewOnly = admin && !own;
  // The Super Admin looking at one account sees the projects the way that account does: its own part, status and progress.
  const lens: typeof user.role = admin && pm && !own ? (pm.startsWith("MD_") ? "marketing" : "pm") : user.role;
  const scope = [await visibleProjectFilter(user), ...(own ? [{ owner: user.username }] : []), ...(pm ? [accountFilter(pm)] : [])];

  const filter: Record<string, unknown>[] = [...scope, { archived: showArchived }];
  if (PROJECT_TYPES.includes(type as never)) filter.push({ type });
  if (status in PROJECT_STATUS) {
    // On a project with both parts, the Project Manager filters by the software part and Marketing by the marketing part.
    const part = lens === "pm" ? "softwareStatus" : lens === "marketing" ? "marketingStatus" : "";
    filter.push(part && status !== "on-hold"
      ? { $or: [{ type: { $ne: "both" }, status }, { type: "both", status: { $ne: "on-hold" }, [part]: status }, { type: "both", [part]: { $exists: false }, status }] }
      : { status });
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.push({ $or: [{ name: rx }, { code: rx }, { clientName: rx }] });
  }
  const where = { $and: filter };

  await connectDb();
  const [rows, total, tally, accounts, incoming, people, marketingSet] = await Promise.all([
    Project.find(where).select("code name clientName type status softwareStatus marketingStatus startDate dueDate description owner").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Project.countDocuments(where),
    Project.find({ $and: scope }).select("status type softwareStatus marketingStatus archived").lean(),
    viewOnly ? User.find({ role: { $in: ["pm", "marketing"] } }).select("username fullName").sort({ username: 1 }).lean() : [],
    user.role === "pm" || viewOnly ? Lead.find({ status: "Converted" }).select("business phone email address owner notes next date").sort({ updatedAt: -1 }).limit(50).lean() : [],
    activeEmployees(),
    marketingUsernames(),
  ]);
  const employees = people.map((p) => ({ username: p.username, label: p.fullName ? `${p.fullName} (${p.username})` : p.username }));
  const milestones = await Milestone.find({ projectId: { $in: rows.map((r) => r._id) } }).select("projectId title department status assignees startDate dueDate").sort({ createdAt: 1 }).lean();
  const taskRows = await Task.find({ projectId: { $in: rows.map((r) => r._id) } }).select("projectId milestoneId code title status priority assigneeCode startDate dueDate description department").sort({ createdAt: 1 }).lean();
  // Each person sees the part of the project they run: Software for the project manager, Marketing for the marketing head, both for the Super Admin.
  const partsOf = (type: ProjectType): Department[] => (["software", "marketing"] as Department[]).filter((d) => (admin && lens === user.role) || canManageDepartment(lens, type, d));
  const progressOf = (id: unknown, type: ProjectType) => {
    const parts = partsOf(type);
    const mine = taskRows.filter((t) => String(t.projectId) === String(id) && parts.includes(t.department as Department));
    const done = mine.filter((t) => t.status === "done").length;
    return { done, total: mine.length, percent: mine.length ? Math.round((done / mine.length) * 100) : 0 };
  };
  const software = employees.filter((e) => !marketingSet.has(e.username));
  const marketing = employees.filter((e) => marketingSet.has(e.username));
  const mixed = employees.map((e) => ({ ...e, label: `${e.label} · ${marketingSet.has(e.username) ? "Marketing" : "Software"}` }));
  // The project name opens just the Milestones part: each milestone's task board, with edit and delete beside every milestone and task.
  const boardDialog = (r: (typeof rows)[number]) => {
    const type = r.type as ProjectType;
    const parts = partsOf(type);
    const lanes = (["software", "marketing"] as Department[]).filter((d) => canManageDepartment(user.role, type, d));
    return (
      <DialogButton wide label="Milestones and tasks" title={r.name} subtitle={`${r.code} · ${r.clientName} · ${type}`} icon={<Flag className="h-4 w-4" />}>
        <MilestonesBoard
          projectCode={r.code}
          type={type}
          role={user.role}
          username={user.username}
          lanes={lanes}
          milestones={milestones.filter((m) => String(m.projectId) === String(r._id) && parts.includes(m.department as Department))}
          tasks={taskRows.filter((t) => String(t.projectId) === String(r._id))}
          software={software}
          marketing={marketing}
          mixed={lanes.length > 1 ? mixed : lanes[0] === "marketing" ? marketing : software}
        />
      </DialogButton>
    );
  };
  const viewDialog = (r: (typeof rows)[number], trigger?: React.ReactNode) => (
    <ProjectView project={{ ...r, status: statusFor(lens, r) }} partsLine={user.role === "superadmin" ? partsLine(r) : ""} parts={partsOf(r.type as ProjectType)} milestones={milestones} tasks={taskRows} trigger={trigger} />
  );
  const active = tally.filter((p) => !p.archived);
  const inProgress = active.filter((p) => statusFor(lens, p) === "in-progress").length;
  const completed = active.filter((p) => statusFor(lens, p) === "completed").length;
  const onHold = active.filter((p) => statusFor(lens, p) === "on-hold").length + tally.length - active.length;
  const keep = { ...keepOwn(own), ...(pm ? { pm } : {}) };

  return (
    <>
      <PageHeader title="Projects" subtitle={own ? "Your projects, sprints, milestones and reports." : showArchived ? "Archived projects." : "Delivery work for clients."}>
        <div className="flex gap-2">
          <Link prefetch={false} href={`/projects${showArchived ? "" : "?archived=1"}${own ? `${showArchived ? "?" : "&"}own=1` : pm ? `${showArchived ? "?" : "&"}pm=${encodeURIComponent(pm)}` : ""}`} className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-brand-50">{showArchived ? "Active projects" : "Archived"}</Link>
          <Link prefetch={false} href={own ? "/projects/new?own=1" : "/projects/new"} className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New project</Link>
        </div>
      </PageHeader>
      {admin && <AccessBar own={own} pm={pm} path="/projects" accounts={accounts.map((a) => ({ username: a.username, label: a.fullName ? `${a.fullName} (${a.username})` : a.username }))} />}
      <Kpis items={[{ label: "Total projects", value: inProgress + completed, hint: "In progress + completed" }, { label: "In progress", value: inProgress }, { label: "Completed", value: completed }, { label: "On hold", value: onHold, hint: "Includes archived" }]} />
      <SearchBar
        keep={keep}
        q={q}
        placeholder="Search by project, code or client"
        filters={[
          { name: "type", label: "All types", value: type, options: PROJECT_TYPES.map((t) => ({ value: t, label: t[0]!.toUpperCase() + t.slice(1) })) },
          { name: "status", label: "All statuses", value: status, options: Object.entries(PROJECT_STATUS).map(([value, label]) => ({ value, label })) },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState title="No projects here" text="Projects start from a client. Use New project." />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.code}
          columns={[
            { header: "Project ID", cell: (r) => <span className="font-semibold">{r.code}</span> },
            { header: "Project name", cell: (r) => viewDialog(r, r.name) },
            { header: "Client", cell: (r) => r.clientName },
            { header: "Type", cell: (r) => <span className="capitalize">{r.type}</span> },
            { header: "Status", cell: (r) => { const shown = statusFor(lens, r); const parts = user.role === "superadmin" ? partsLine(r) : ""; return <div><Badge tone={shown === "completed" ? "success" : shown === "on-hold" ? "warning" : "info"}>{PROJECT_STATUS[shown as keyof typeof PROJECT_STATUS]}</Badge>{parts && <p className="mt-1 text-xs text-muted">{parts}</p>}</div>; } },
            {
              header: "Progress",
              cell: (r) => {
                const p = progressOf(r._id, r.type as ProjectType);
                return (
                  <div className="min-w-32" title={`${p.done} of ${p.total} tasks done`}>
                    <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{p.total ? `${p.done}/${p.total} tasks` : "No tasks"}</span><strong>{p.percent}%</strong></div>
                    <div className="h-2 overflow-hidden rounded-full bg-brand-50" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Project progress">
                      <div className="brand-gradient h-full rounded-full" style={{ width: `${p.percent}%` }} />
                    </div>
                  </div>
                );
              },
            },
            { header: "Due", cell: (r) => r.dueDate || "—" },
            {
              header: "Actions",
              cell: (r) => {
                const type = r.type as ProjectType;
                const lanes = (["software", "marketing"] as Department[]).filter((d) => canManageDepartment(user.role, type, d));
                const editShell = canEditProjectShell(user.role, type);
                return (
                  <div className="flex items-center gap-2">
                    {viewDialog(r)}
                    {editShell && (
                      <DialogButton label="Edit project" title="Edit project" subtitle={`${r.code} · ${r.clientName}`} icon={<Pencil className="h-4 w-4" />}>
                        <ActionForm action={updateProjectAction} submit="Save details" className="grid gap-3 sm:grid-cols-2">
                          <input type="hidden" name="code" value={r.code} />
                          <div className="sm:col-span-2"><Field label="Project name" name="name" defaultValue={r.name} required /></div>
                          <SelectField label="Status" name="status" defaultValue={r.status}>
                            {Object.entries(PROJECT_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                          </SelectField>
                          <span />
                          <Field label="Start" name="startDate" type="date" defaultValue={r.startDate} />
                          <Field label="Due" name="dueDate" type="date" defaultValue={r.dueDate} />
                          <div className="sm:col-span-2"><TextareaField label="Description" name="description" defaultValue={r.description} /></div>
                        </ActionForm>
                      </DialogButton>
                    )}
                    {lanes.length > 0 && boardDialog(r)}
                  </div>
                );
              },
            },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, type, status, archived: showArchived ? "1" : "", ...keep }} />
      {(user.role === "pm" || viewOnly) && !showArchived && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">From sales</h2>
          <p className="mb-3 text-sm text-muted">Clients whose follow-up was marked Converted. Sales sends these projects to the project manager.</p>
          {incoming.length === 0 ? <EmptyState title="Nothing from sales yet" text="Converted clients will appear here." /> : (
            <DataTable
              rows={incoming}
              rowKey={(r) => String(r._id)}
              columns={[
                { header: "Phone / customer", cell: (r) => <span><strong>{r.phone || "—"}</strong><span className="block text-xs font-normal text-muted">{r.business}</span></span> },
                { header: "Email", cell: (r) => r.email || "—" },
                { header: "Address", cell: (r) => r.address || "—" },
                { header: "Sales admin", cell: (r) => r.owner },
                { header: "Follow-up", cell: (r) => formatDay(r.next || r.date) },
                { header: "Notes", cell: (r) => r.notes || "—" },
              ]}
            />
          )}
        </section>
      )}
    </>
  );
}
