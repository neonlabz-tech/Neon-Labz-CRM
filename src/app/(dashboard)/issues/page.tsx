import { AlertTriangle, CheckCircle2, CircleDot, Loader } from "lucide-react";
import { IssueForm } from "@/components/issues/issue-form";
import { AUDIENCE_SHORT } from "@/lib/audience";
import { AccessBar } from "@/components/projects/access-bar";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Stat } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { requireAction } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, isOverdue, PRIORITY_TONE, STATUS_TONE, type IssuePriority, type IssueStatus } from "@/lib/issues";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { isId, visibleProjectFilter, historyProjectCodes } from "@/lib/project-access";
import { teamMembersFor } from "@/lib/team";
import { deleteIssueAction } from "@/server/issue-actions";
import { Issue } from "@/models/issue";
import { User } from "@/models/user";
import { Project } from "@/models/project";

export const metadata = { title: "Issues" };

export default async function IssuesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("issues.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const status = param(sp, "status");
  const priority = param(sp, "priority");
  const project = param(sp, "project");
  const assignee = param(sp, "assignee");
  const account = user.role === "superadmin" ? param(sp, "pm") : "";
  const page = pageOf(sp);
  const edit = param(sp, "edit");
  const adding = param(sp, "new") === "1";
  const today = todayISO();

  // The Super Admin looks after every issue, so the work carries on when a project manager leaves.
  // A project manager or marketing head sees their own issues and the ones the Super Admin sent to their team.
  // Picking an account as the Super Admin shows that person's own issues plus the ones sent to their team.
  const who = user.role === "superadmin" ? account : user.username;
  const team = user.role === "pm" || who.startsWith("PM_") ? "pm" : user.role === "marketing" || who.startsWith("MD_") ? "marketing" : "";
  // Issues of a project that is in History stay hidden until the project is moved back to active.
  const history = await historyProjectCodes();
  const mine: Record<string, unknown> = {
    ...(user.role === "superadmin" && !account ? {} : { $and: [{ $or: [{ createdBy: who }, ...(team ? [{ audience: { $in: [team, "both"] } }] : [])] }] }),
    projectCode: { $nin: history },
  };
  const filter: Record<string, unknown> = { ...mine };
  if (status in ISSUE_STATUSES) filter.status = status;
  if (priority in ISSUE_PRIORITIES) filter.priority = priority;
  if (project && !history.includes(project)) filter.projectCode = project;
  if (assignee) filter.assignee = assignee;
  if (q) { const rx = new RegExp(escapeRegex(q), "i"); filter.$or = [{ title: rx }, { code: rx }, { description: rx }]; }

  await connectDb();
  const [projects, members, rows, total, counts, overdue, editing, accounts] = await Promise.all([
    Project.find({ archived: false, ...(await visibleProjectFilter(user)) }).select("code name").sort({ name: 1 }).limit(300).lean(),
    teamMembersFor(user.role),
    Issue.find(filter).select("code title projectCode status priority assignee reportedAt dueDate audience").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Issue.countDocuments(filter),
    Issue.aggregate<{ _id: string; n: number }>([{ $match: mine }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Issue.countDocuments({ ...mine, status: { $in: ["open", "in-progress"] }, dueDate: { $ne: "", $lt: today } }),
    isId(edit) ? Issue.findOne({ _id: edit, ...mine }).lean() : null,
    user.role === "superadmin" ? User.find({ role: { $in: ["pm", "marketing"] } }).select("username fullName").sort({ username: 1 }).lean() : [],
  ]);
  const n = (key: string) => counts.find((c) => c._id === key)?.n ?? 0;
  const nameOf = new Map(members.map((m) => [m.username, m.name]));
  const projectName = new Map(projects.map((p) => [p.code, p.name]));

  return (
    <>
      {user.role === "superadmin" && <AccessBar own={false} editable pm={account} path="/issues" accounts={accounts.map((a) => ({ username: a.username, label: a.fullName ? `${a.fullName} (${a.username})` : a.username }))} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Track bugs and follow-up items against your projects.</p>
        <AddLink href="?new=1">New issue</AddLink>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open" value={n("open")} icon={<CircleDot className="h-5 w-5" />} />
        <Stat label="In progress" value={n("in-progress")} icon={<Loader className="h-5 w-5" />} />
        <Stat label="Resolved or closed" value={n("resolved") + n("closed")} icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat label="Overdue" value={overdue} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>
      {(adding || editing) && (
        <Panel title={editing ? "Edit issue" : "New issue"} subtitle={editing?.code} closeHref="/issues">
          <IssueForm
            showAudience={user.role === "superadmin"}
            projects={projects}
            members={members}
            values={editing ? {
              id: String(editing._id), title: editing.title, projectCode: editing.projectCode, status: editing.status, priority: editing.priority, type: editing.type,
              assignee: editing.assignee, audience: editing.audience, dueDate: editing.dueDate, description: editing.description, steps: editing.steps, expected: editing.expected,
            } : { title: "", projectCode: "", status: "open", priority: "medium", type: "bug", assignee: "", dueDate: "", description: "", steps: "", expected: "" }}
          />
        </Panel>
      )}
      <SearchBar q={q} keep={account ? { pm: account } : {}} placeholder="Search by code, title or description" filters={[
        { name: "status", label: "All statuses", value: status, options: Object.entries(ISSUE_STATUSES).map(([value, label]) => ({ value, label })) },
        { name: "priority", label: "All priorities", value: priority, options: Object.entries(ISSUE_PRIORITIES).map(([value, label]) => ({ value, label })) },
        { name: "project", label: "All projects", value: project, options: projects.map((p) => ({ value: p.code, label: p.name })) },
        { name: "assignee", label: "Anyone", value: assignee, options: members.map((m) => ({ value: m.username, label: m.name })) },
      ]} />
      {rows.length === 0 ? <EmptyState title="No issues found" text="Add an issue to start tracking it." /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Issue", cell: (r) => <span>{r.title} <span className="font-normal text-muted">· {r.code}</span></span> },
            { header: "Project", cell: (r) => projectName.get(r.projectCode) ?? r.projectCode },
            { header: "Status", cell: (r) => <Badge tone={STATUS_TONE[r.status as IssueStatus]}>{ISSUE_STATUSES[r.status as IssueStatus]}</Badge> },
            { header: "Priority", cell: (r) => <Badge tone={PRIORITY_TONE[r.priority as IssuePriority]}>{ISSUE_PRIORITIES[r.priority as IssuePriority]}</Badge> },
            ...(user.role === "superadmin" ? [{ header: "Sent to", cell: (r: (typeof rows)[number]) => (r.audience ? AUDIENCE_SHORT[r.audience as keyof typeof AUDIENCE_SHORT] : "Creator only") }] : []),
            { header: "Assigned to", cell: (r) => (r.assignee ? nameOf.get(r.assignee) ?? r.assignee : "—") },
            { header: "Reported", cell: (r) => r.reportedAt },
            { header: "Due", cell: (r) => (r.dueDate ? <span className={isOverdue(r, today) ? "font-semibold text-danger" : ""}>{r.dueDate}</span> : "—") },
            { header: "Actions", cell: (r) => <RowActions id={String(r._id)} editHref={`?edit=${r._id}`} remove={{ action: deleteIssueAction, title: "Delete this issue?", text: "This cannot be undone." }} /> },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, status, priority, project, assignee, ...(account ? { pm: account } : {}) }} />
    </>
  );
}
