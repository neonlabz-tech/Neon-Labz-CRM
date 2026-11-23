import { AccessBar } from "@/components/projects/access-bar";
import { MilestoneAddForm } from "@/components/projects/milestone-add-form";
import { MilestonesBoard } from "@/components/projects/milestones-board";
import { DialogButton } from "@/components/ui/dialog-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { requireAction } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { connectDb } from "@/lib/db";
import { keepOwn, ownView } from "@/lib/own";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { accountFilter, activeEmployees, isMarketingAccount, marketingUsernames, visibleProjectFilter } from "@/lib/project-access";
import { canManageDepartment, MILESTONE_STATUS, type Department, type ProjectType } from "@/lib/projects";
import { formatDay } from "@/lib/utils";
import { Milestone } from "@/models/milestone";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { User } from "@/models/user";

export const metadata = { title: "Milestones" };

const tone = (status: string) => (status === "done" ? "success" : status === "at-risk" ? "danger" : status === "in-progress" ? "info" : "warning");

export default async function MilestonesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("projects.view");
  const sp = await searchParams;
  const own = ownView(user.role, sp);
  const pm = param(sp, "pm");
  const q = param(sp, "q");
  const status = param(sp, "status");
  const assigned = param(sp, "assigned");
  const page = pageOf(sp);
  const admin = user.role === "superadmin";

  await connectDb();
  const [projects, accounts] = await Promise.all([
    Project.find({ $and: [{ archived: false }, await visibleProjectFilter(user), ...(own ? [{ owner: user.username }] : []), ...(pm ? [accountFilter(pm)] : [])] }).select("code name clientName type status startDate dueDate description").lean(),
    admin && !own ? User.find({ role: { $in: ["pm", "marketing"] } }).select("username fullName").sort({ username: 1 }).lean() : [],
  ]);
  const byId = new Map(projects.map((p) => [String(p._id), p]));
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const matchedProjects = rx ? projects.filter((p) => rx.test(p.name) || rx.test(p.code)).map((p) => p._id) : [];
  const conditions: Record<string, unknown>[] = [
    { projectId: { $in: projects.map((p) => p._id) } },
    // On a project that has both parts, a Project Manager sees the software milestones and Marketing sees the marketing ones.
    ...(user.role === "pm" ? [{ department: "software" }] : user.role === "marketing" ? [{ department: "marketing" }] : []),
    // The Super Admin looking at one account sees that account's part of each project.
    ...(admin && pm ? [{ department: isMarketingAccount(pm) ? "marketing" : "software" }] : []),
    ...(status in MILESTONE_STATUS ? [{ status }] : []),
    ...(assigned ? [{ assignees: assigned }] : []),
    ...(rx ? [{ $or: [{ title: rx }, { projectId: { $in: matchedProjects } }] }] : []),
  ];
  const filter = { $and: conditions };
  const [rows, total] = await Promise.all([
    Milestone.find(filter).sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Milestone.countDocuments(filter),
  ]);
  // The window behind a project name shows that project's own milestones and tasks, for the part the person runs.
  const shownIds = [...new Set(rows.map((r) => String(r.projectId)))].flatMap((id) => { const project = byId.get(id); return project ? [project._id] : []; });
  const [projectMilestones, projectTasks, people, marketingSet] = await Promise.all([
    Milestone.find({ projectId: { $in: shownIds } }).select("projectId title department status assignees startDate dueDate").sort({ createdAt: 1 }).lean(),
    Task.find({ projectId: { $in: shownIds } }).select("projectId milestoneId code title status priority assigneeCode startDate dueDate description department").sort({ createdAt: 1 }).lean(),
    activeEmployees(),
    marketingUsernames(),
  ]);
  const partsOf = (type: ProjectType): Department[] => (["software", "marketing"] as Department[]).filter((d) => admin || canManageDepartment(user.role, type, d));
  const employees = people.map((e) => ({ username: e.username, label: e.fullName ? `${e.fullName} (${e.username})` : e.username }));
  const software = employees.filter((e) => !marketingSet.has(e.username));
  const marketing = employees.filter((e) => marketingSet.has(e.username));
  const mixed = employees.map((e) => ({ ...e, label: `${e.label} · ${marketingSet.has(e.username) ? "Marketing" : "Software"}` }));
  // Clicking a project or a milestone opens that project's task board: drag a task to a new column to change its status.
  const boardDialog = (project: (typeof projects)[number], trigger: React.ReactNode) => {
    const type = project.type as ProjectType;
    const parts = partsOf(type);
    const lanes = (["software", "marketing"] as Department[]).filter((d) => canManageDepartment(user.role, type, d));
    return (
      <DialogButton wide label="Milestones and tasks" title={project.name} subtitle={`${project.code} · ${project.clientName} · ${type}`} trigger={trigger}>
        <MilestonesBoard
          projectCode={project.code}
          type={type}
          role={user.role}
          username={user.username}
          lanes={lanes}
          milestones={projectMilestones.filter((m) => String(m.projectId) === String(project._id) && parts.includes(m.department as Department))}
          tasks={projectTasks.filter((t) => String(t.projectId) === String(project._id))}
          software={software}
          marketing={marketing}
          mixed={lanes.length > 1 ? mixed : lanes[0] === "marketing" ? marketing : software}
        />
      </DialogButton>
    );
  };
  // The Assigned filter lists the people of the part the signed-in person runs; the Super Admin sees everyone.
  const assignable = employees.filter((e) => admin || (user.role === "marketing" ? marketingSet.has(e.username) : !marketingSet.has(e.username)));
  const keep = { ...keepOwn(own), ...(pm ? { pm } : {}) };
  // Add a milestone from here. The Super Admin chooses which team it goes to; a project manager or marketing head adds to their own part.
  const canAdd = can(user.role, "projects.manage");
  const adding = canAdd && param(sp, "new") === "1";
  const query = new URLSearchParams(keep).toString();
  const base = `/milestones${query ? `?${query}` : ""}`;
  const addable = adding ? await Project.find({ archived: false, ...(await visibleProjectFilter(user)) }).select("code name type").sort({ name: 1 }).limit(300).lean() : [];

  return (
    <>
      <PageHeader title="Milestones" subtitle="Every milestone across your projects. Click a project or milestone to see its tasks and drag them between statuses.">
        {canAdd && <AddLink href={`/milestones?${new URLSearchParams({ ...keep, new: "1" }).toString()}`}>Add milestone</AddLink>}
      </PageHeader>
      {adding && (
        <Panel title="Add milestone" subtitle={admin ? "Choose the project and who it goes to." : "Choose the project."} closeHref={base}>
          <MilestoneAddForm projects={addable.map((p) => ({ code: p.code, name: p.name, type: p.type as ProjectType }))} employees={admin ? mixed : user.role === "marketing" ? marketing : software} admin={admin} department={user.role === "marketing" ? "marketing" : "software"} />
        </Panel>
      )}
      {admin && <AccessBar own={own} editable pm={pm} path="/milestones" accounts={accounts.map((a) => ({ username: a.username, label: a.fullName ? `${a.fullName} (${a.username})` : a.username }))} />}
      <SearchBar q={q} keep={keep} placeholder="Search by milestone or project" filters={[
        { name: "status", label: "All statuses", value: status, options: Object.entries(MILESTONE_STATUS).map(([value, label]) => ({ value, label })) },
        { name: "assigned", label: "All assigned", value: assigned, options: assignable.map((e) => ({ value: e.username, label: e.label })) },
      ]} />
      {rows.length === 0 ? <EmptyState title="No milestones yet" text={canAdd ? "Use Add milestone to create one." : "Milestones are added inside each project."} /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Project", cell: (r) => { const project = byId.get(String(r.projectId)); return project ? boardDialog(project, project.name) : "Project removed"; } },
            { header: "Milestone", cell: (r) => { const project = byId.get(String(r.projectId)); return project ? boardDialog(project, r.title) : r.title; } },
            { header: "Part", cell: (r) => <span className="capitalize">{r.department}</span> },
            { header: "Start", cell: (r) => formatDay(r.startDate) },
            { header: "Due", cell: (r) => formatDay(r.dueDate) },
            { header: "Assigned", cell: (r) => (r.assignees.length ? r.assignees.join(", ") : "—") },
            { header: "Status", cell: (r) => <Badge tone={tone(r.status)}>{MILESTONE_STATUS[r.status as keyof typeof MILESTONE_STATUS]}</Badge> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, status, assigned, ...keep }} />
    </>
  );
}
