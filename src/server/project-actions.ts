"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audienceFitMessage, audienceFits } from "@/lib/audience";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { nextSeq, projectCode } from "@/lib/counters";
import { dateIsAllowed } from "@/lib/dates";
import { done, fail, invalid } from "@/lib/form";
import { workTypeOfClient } from "@/lib/work-type";
import { notifyRole, notifyUsers, notifyWork } from "@/lib/notify";
import { findProject, isId, marketingUsernames, syncProjectStatus, validEmployeeCodes } from "@/lib/project-access";
import { canEditProjectShell, canManageDepartment, defaultDepartment, type Department, type ProjectType } from "@/lib/projects";
import { milestoneSchema, projectSchema, projectUpdateSchema } from "@/schemas/project";
import { Client } from "@/models/client";
import { Milestone } from "@/models/milestone";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import type { ActionState } from "@/types";

const TYPES_BY_ROLE = { superadmin: ["software", "marketing", "both"], pm: ["software", "both"], marketing: ["marketing"] } as const;

export async function createProjectAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const allowed = (TYPES_BY_ROLE as Record<string, readonly string[]>)[user.role] ?? [];
  if (!allowed.includes(input.type)) return fail("You cannot create that type of project.");

  await connectDb();
  const client = await Client.findOne({ code: input.clientCode }).select("name service workType ownOnly guest").lean();
  if (!client || (client.ownOnly && user.role !== "superadmin")) return fail("Choose a client.");
  // Dates in the past are allowed only for a guest client (an old project brought in).
  if (!client.guest) {
    if (input.startDate && !dateIsAllowed(input.startDate)) return fail("Start date cannot be before today.");
    if (input.dueDate && !dateIsAllowed(input.dueDate)) return fail("Due date cannot be before today.");
  }
  const bought = workTypeOfClient(client);
  if (input.type === "both" ? bought !== "both" : bought !== "both" && bought !== input.type) return { ok: false, message: "This client did not buy that kind of work.", errors: { type: `${client.name} bought ${bought} work, so choose a matching project type.` } };
  if (await Project.exists({ clientCode: input.clientCode, type: input.type, archived: false })) return { ok: false, message: "This client already has that project.", errors: { clientCode: "An active project of this type already exists for this client." } };

  const code = projectCode(await nextSeq("project"));
  await Project.create({ ...input, code, owner: user.username, clientName: client.name, service: client.service });
  const text = `${user.username} started ${client.name} as a ${input.type === "both" ? "software and marketing" : input.type} project. Open Projects to plan your side.`;
  if (user.role === "pm" && input.type === "both") await notifyRole("marketing", text, `/projects/${code}`);
  if (user.role === "superadmin") await notifyWork(input.type, text, `/projects/${code}`);
  await writeAudit(user.username, "project.created", { code, client: input.clientCode });
  revalidatePath("/projects");
  redirect(`/projects/${code}`);
}

export async function updateProjectAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const parsed = projectUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { code, ...data } = parsed.data;
  const project = await findProject(user, code);
  if (!project) return fail("Project not found.");
  if (!canEditProjectShell(user.role, project.type)) return fail("You cannot change this project's details.");
  const guest = Boolean(await Client.exists({ code: project.clientCode, guest: true }));
  if (!guest && data.startDate && !dateIsAllowed(data.startDate, project.startDate ?? "")) return fail("Start date cannot be before today.");
  if (!guest && data.dueDate && !dateIsAllowed(data.dueDate, project.dueDate ?? "")) return fail("Due date cannot be before today.");
  Object.assign(project, data);
  await project.save();
  await writeAudit(user.username, "project.updated", { code });
  revalidatePath("/projects");
  revalidatePath(`/projects/${code}`);
  return done("Project saved.");
}

export async function archiveProjectAction(code: string, archived: boolean): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const project = await findProject(user, code);
  if (!project) return fail("Project not found.");
  if (!canEditProjectShell(user.role, project.type)) return fail("You cannot change this project.");
  project.archived = archived;
  await project.save();
  await writeAudit(user.username, archived ? "project.archived" : "project.restored", { code });
  revalidatePath("/projects");
  revalidatePath(`/projects/${code}`);
  return done(archived ? "Project moved to history." : "Project moved back to active.");
}

export async function setTeamAction(code: string, lane: "software" | "marketing", usernames: string[]): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const project = await findProject(user, code);
  if (!project) return fail("Project not found.");
  if (!canManageDepartment(user.role, project.type, lane)) return fail("You cannot change this team.");
  const team = await validEmployeeCodes(usernames, user);
  const added = team.filter((c) => !(lane === "software" ? project.assignees : project.marketingAssignees).includes(c));
  if (lane === "software") project.assignees = team;
  else project.marketingAssignees = team;
  await project.save();
  await notifyUsers(added, `${user.username} added you to ${project.name}. Open the project to see your tasks.`, `/projects/${code}`);
  await writeAudit(user.username, "project.team", { code, lane, team });
  revalidatePath("/projects");
  revalidatePath(`/projects/${code}`);
  return done("Team saved.");
}

/**
 * Putting someone on a milestone also puts them on the project team. When they come off every milestone and task of the project
 * (a milestone deleted, or edited without them), they leave the team too, so the project stops showing in their My work.
 */
async function dropIdlePeople(project: NonNullable<Awaited<ReturnType<typeof findProject>>>, people: string[]) {
  const wanted = [...new Set(people)];
  if (!wanted.length) return;
  const [milestones, tasks] = await Promise.all([
    Milestone.find({ projectId: project._id, assignees: { $in: wanted } }).select("assignees").lean(),
    Task.find({ projectId: project._id, assigneeCode: { $in: wanted } }).select("assigneeCode").lean(),
  ]);
  const busy = new Set([...milestones.flatMap((m) => m.assignees), ...tasks.map((t) => t.assigneeCode)]);
  const gone = wanted.filter((p) => !busy.has(p));
  if (!gone.length) return;
  project.assignees = project.assignees.filter((a) => !gone.includes(a));
  project.marketingAssignees = project.marketingAssignees.filter((a) => !gone.includes(a));
  await project.save();
}

export async function saveMilestoneAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const raw = { ...Object.fromEntries(formData), assignees: formData.getAll("assignees") };
  const parsed = milestoneSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectCode: code, id, audience: sent, ...data } = parsed.data;

  const project = await findProject(user, code);
  if (!project) return fail("Project not found.");
  const type = project.type as ProjectType;
  // The Super Admin adding a milestone picks the team: Project Manager (software), Marketing (MD) or both (one milestone for each).
  const audience = user.role === "superadmin" && !id && sent ? sent : "";
  if (audience && !audienceFits(type, audience)) return fail(audienceFitMessage(type));
  const departments: Department[] =
    audience === "both" ? (type === "both" ? ["software", "marketing"] : [defaultDepartment(type)])
    : audience === "pm" ? ["software"]
    : audience === "marketing" ? ["marketing"]
    : [type === "both" ? data.department : defaultDepartment(type)];
  for (const department of departments) {
    if (!canManageDepartment(user.role, type, department)) return fail("You cannot manage milestones in this part of the project.");
  }

  const all = await validEmployeeCodes(data.assignees, user);
  const marketingSet = await marketingUsernames();
  const teamOf = (department: Department) => all.filter((a) => marketingSet.has(a) === (department === "marketing"));
  // With both teams the people picked are split between the two milestones; otherwise they must all belong to the one team.
  if (departments.length === 1 && all.some((a) => marketingSet.has(a) !== (departments[0] === "marketing"))) {
    return fail(departments[0] === "marketing" ? "Choose employees from the marketing team only." : "Choose employees from the software team only.");
  }

  const existing = id && isId(id) ? await Milestone.findOne({ _id: id, projectId: project._id }) : null;
  if (id && !existing) return fail("Milestone not found.");
  // A milestone must fit inside the project's own dates (checked when the date is new or changed).
  const outside = (d: string) => Boolean(d) && ((project.startDate && d < project.startDate) || (project.dueDate && d > project.dueDate));
  const projectRange = `${project.startDate || "…"} → ${project.dueDate || "…"}`;
  if (data.startDate && data.startDate !== existing?.startDate && outside(data.startDate)) return fail(`Start date must be within the project dates (${projectRange}).`);
  if (data.dueDate !== existing?.dueDate && outside(data.dueDate)) return fail(`Due date must be within the project dates (${projectRange}).`);
  const guestClient = Boolean(await Client.exists({ code: project.clientCode, guest: true }));
  for (const department of departments) {
    if (!teamOf(department).length) {
      return fail(departments.length > 1 ? `Choose at least one ${department === "marketing" ? "marketing" : "software"} employee, because this goes to both teams.` : "Assign at least one employee to this milestone.");
    }
    if (department === "marketing") {
      if (!guestClient && data.startDate && !dateIsAllowed(data.startDate, existing?.startDate ?? "")) return fail("Start date cannot be before today.");
      if (!guestClient && !dateIsAllowed(data.dueDate, existing?.dueDate ?? "")) return fail("Due date cannot be before today.");
    }
  }

  const removed: string[] = [];
  for (const department of departments) {
    const assignees = teamOf(department);
    if (existing) removed.push(...existing.assignees.filter((a) => !assignees.includes(a)));
    if (existing) {
      Object.assign(existing, { ...data, department, assignees });
      await existing.save();
    } else {
      await Milestone.create({ ...data, department, assignees, projectId: project._id });
    }
    // Anyone named on a milestone joins that part of the team.
    const lane = department === "marketing" ? "marketingAssignees" : "assignees";
    // People newly put on this milestone hear about it, and the project card on My work shows a count until they open it.
    const fresh = assignees.filter((a) => !(existing?.assignees ?? []).includes(a));
    await notifyUsers(fresh, `${user.username} added you to the milestone “${data.title}” on ${project.name}.`, `/projects/${code}`);
    project[lane] = [...new Set([...project[lane], ...assignees])];
  }
  await project.save();
  await dropIdlePeople(project, removed);
  await syncProjectStatus(project._id);

  revalidatePath("/projects");
  revalidatePath("/milestones");
  revalidatePath(`/projects/${code}`);
  return done(existing ? "Milestone saved." : departments.length > 1 ? "Milestone added for both teams." : "Milestone added.");
}

export async function deleteMilestoneAction(code: string, id: string): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const project = await findProject(user, code);
  const milestone = project && isId(id) ? await Milestone.findOne({ _id: id, projectId: project._id }) : null;
  if (!project || !milestone) return fail("Milestone not found.");
  if (!canManageDepartment(user.role, project.type, milestone.department)) return fail("You cannot delete this milestone.");
  await Task.deleteMany({ milestoneId: milestone._id });
  await milestone.deleteOne();
  await dropIdlePeople(project, milestone.assignees);
  await syncProjectStatus(project._id);
  await writeAudit(user.username, "milestone.deleted", { code, milestone: milestone.title });
  revalidatePath("/projects");
  revalidatePath(`/projects/${code}`);
  return done("Milestone deleted.");
}
