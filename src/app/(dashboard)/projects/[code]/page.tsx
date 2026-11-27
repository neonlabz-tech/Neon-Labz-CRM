import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveProject } from "@/components/projects/project-actions";
import { ProjectSeen } from "@/components/projects/project-seen";
import { MilestonesBoard } from "@/components/projects/milestones-board";
import { TeamForm } from "@/components/projects/team-form";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { requireAction, requireUser } from "@/lib/auth";
import { param, type SearchParams } from "@/lib/pagination";
import { connectDb } from "@/lib/db";
import { activeEmployees, marketingUsernames, employeeOnMilestone, findProject } from "@/lib/project-access";
import { can } from "@/lib/permissions";
import { canEditProjectShell, canManageDepartment, partsLine, PROJECT_STATUS, statusFor, type Department, type ProjectType } from "@/lib/projects";
import { Milestone } from "@/models/milestone";
import { Task } from "@/models/task";
import { updateProjectAction } from "@/server/project-actions";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  if (user.role === "employee") await requireAction("tasks.work");
  const { code } = await params;
  // Opened from My work (work=1): stay in My work, show only the person's own milestones and no project settings.
  const fromWork = param(await searchParams, "work") === "1" && can(user.role, "tasks.work");
  const project = await findProject(user, code);
  if (!project) notFound();

  await connectDb();
  const [milestones, tasks, people, marketingSet] = await Promise.all([
    Milestone.find({ projectId: project._id }).sort({ createdAt: 1 }).lean(),
    Task.find({ projectId: project._id }).sort({ createdAt: -1 }).lean(),
    activeEmployees(),
    marketingUsernames(),
  ]);
  // Employees, plus Project Managers and Marketing heads: the Super Admin sees all of them; a PM or MD sees the employees and themselves.
  const employees = people.filter((p) => p.role === "employee" || user.role === "superadmin" || p.username === user.username).map((p) => ({ username: p.username, label: p.fullName ? `${p.fullName} (${p.username})` : p.username }));
  const softwareEmployees = employees.filter((e) => !marketingSet.has(e.username));
  const marketingEmployees = employees.filter((e) => marketingSet.has(e.username));
  const poolFor = (department: Department) => (department === "marketing" ? marketingEmployees : softwareEmployees);
  const mixedPool = employees.map((e) => ({ ...e, label: `${e.label} · ${marketingSet.has(e.username) ? "Marketing" : "Software"}` }));
  const type = project.type as ProjectType;
  const editShell = canEditProjectShell(user.role, type);
  const lanes = (["software", "marketing"] as Department[]).filter((d) => canManageDepartment(user.role, type, d));
  const isEmployee = user.role === "employee";
  // The Project Manager works with the software part and Marketing with the marketing part; the Super Admin sees both.
  const sees = (d: Department) => isEmployee || user.role === "superadmin" || lanes.includes(d);
  const shownMilestones = isEmployee || fromWork ? milestones.filter((m) => employeeOnMilestone(user.username, { assignees: m.assignees, department: m.department }, project)) : milestones.filter((m) => sees(m.department as Department));

  const shownStatus = statusFor(user.role, project);

  return (
    <>
      <ProjectSeen code={project.code} />
      {fromWork && <Link prefetch={false} href="/my-work" className="mb-3 inline-block text-sm font-semibold text-brand-700 hover:underline">← Back to My work</Link>}
      <PageHeader title={project.name} subtitle={`${project.code} · ${project.clientName} · ${type}`}>
        <div className="flex items-center gap-2">
          <Badge tone={shownStatus === "completed" ? "success" : shownStatus === "on-hold" ? "warning" : "info"}>{PROJECT_STATUS[shownStatus as keyof typeof PROJECT_STATUS]}</Badge>
          {user.role === "superadmin" && partsLine(project) && <span className="text-xs text-muted">{partsLine(project)}</span>}
          {project.archived && <Badge tone="warning">In history</Badge>}
          {editShell && !fromWork && <ArchiveProject code={project.code} archived={project.archived} />}
        </div>
      </PageHeader>

      {!isEmployee && !fromWork && (
        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <h2 className="mb-4 font-semibold">Details</h2>
            {editShell ? (
              <ActionForm action={updateProjectAction} submit="Save details" className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="code" value={project.code} />
                <div className="sm:col-span-2"><Field label="Project name" name="name" defaultValue={project.name} required /></div>
                <SelectField label="Status" name="status" defaultValue={project.status}>
                  {Object.entries(PROJECT_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </SelectField>
                <span />
                <Field label="Start" name="startDate" type="date" defaultValue={project.startDate} />
                <Field label="Due" name="dueDate" type="date" defaultValue={project.dueDate} />
                <div className="sm:col-span-2"><TextareaField label="Description" name="description" defaultValue={project.description} /></div>
              </ActionForm>
            ) : (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Start</dt><dd>{project.startDate || "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Due</dt><dd>{project.dueDate || "—"}</dd></div>
                <p className="whitespace-pre-line text-muted">{project.description || "No description."}</p>
              </dl>
            )}
          </Card>
          <Card className="space-y-5">
            <h2 className="font-semibold">Team</h2>
            {type !== "marketing" && sees("software") && <TeamForm code={project.code} lane="software" title="Software team" employees={softwareEmployees} team={project.assignees} editable={lanes.includes("software")} />}
            {type !== "software" && sees("marketing") && <TeamForm code={project.code} lane="marketing" title="Marketing team" employees={marketingEmployees} team={project.marketingAssignees} editable={lanes.includes("marketing")} />}
          </Card>
        </div>
      )}

      <MilestonesBoard projectStart={project.startDate} projectDue={project.dueDate} projectCode={project.code} type={type} role={user.role} username={user.username} milestones={shownMilestones} tasks={tasks} lanes={lanes} software={softwareEmployees} marketing={marketingEmployees} mixed={lanes.length > 1 ? mixedPool : poolFor(lanes[0] ?? "software")} />
    </>
  );
}
