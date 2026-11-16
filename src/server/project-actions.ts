"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { nextSeq, projectCode } from "@/lib/counters";
import { dateIsAllowed } from "@/lib/dates";
import { done, fail, invalid } from "@/lib/form";
import { workTypeOfClient } from "@/lib/work-type";
import { notifyRole, notifyUsers, notifyWork } from "@/lib/notify";
import { findProject, isId, marketingUsernames, syncProjectStatus, validEmployeeCodes } from "@/lib/project-access";
import { canEditProjectShell, canManageDepartment, defaultDepartment, type ProjectType } from "@/lib/projects";
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

  if (input.startDate && !dateIsAllowed(input.startDate)) return fail("Start date cannot be before today.");
  if (input.dueDate && !dateIsAllowed(input.dueDate)) return fail("Due date cannot be before today.");

  await connectDb();
  const client = await Client.findOne({ code: input.clientCode }).select("name service workType").lean();
  if (!client) return fail("Choose a client.");
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
  if (data.startDate && !dateIsAllowed(data.startDate, project.startDate ?? "")) return fail("Start date cannot be before today.");
  if (data.dueDate && !dateIsAllowed(data.dueDate, project.dueDate ?? "")) return fail("Due date cannot be before today.");
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
  return done(archived ? "Project archived." : "Project restored.");
}

export async function setTeamAction(code: string, lane: "software" | "marketing", usernames: string[]): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const project = await findProject(user, code);
  if (!project) return fail("Project not found.");
  if (!canManageDepartment(user.role, project.type, lane)) return fail("You cannot change this team.");
  const team = await validEmployeeCodes(usernames);
  const added = team.filter((c) => !(lane === "software" ? project.assignees : project.marketingAssignees).includes(c));
  if (lane === "software") project.assignees = team;
  else project.marketingAssignees = team;
  await project.save();
  await notifyUsers(added, `${user.username} added you to ${project.name}. Open My work to see your tasks.`, "/my-work");
  await writeAudit(user.username, "project.team", { code, lane, team });
  revalidatePath("/projects");
  revalidatePath(`/projects/${code}`);
  return done("Team saved.");
}

export async function saveMilestoneAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const raw = { ...Object.fromEntries(formData), assignees: formData.getAll("assignees") };
  const parsed = milestoneSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { projectCode: code, id, ...data } = parsed.data;

  const project = await findProject(user, code);
  if (!project) return fail("Project not found.");
  const department = project.type === "both" ? data.department : defaultDepartment(project.type as ProjectType);
  if (!canManageDepartment(user.role, project.type, department)) return fail("You cannot manage milestones in this part of the project.");
  const assignees = await validEmployeeCodes(data.assignees);
  const marketingSet = await marketingUsernames();
  if (assignees.some((a) => marketingSet.has(a) !== (department === "marketing"))) {
    return fail(department === "marketing" ? "Choose employees from the marketing team only." : "Choose employees from the software team only.");
  }

  const existing = id && isId(id) ? await Milestone.findOne({ _id: id, projectId: project._id }) : null;
  if (id && !existing) return fail("Milestone not found.");
  if (!assignees.length) return fail("Assign at least one employee to this milestone.");
  if (department === "marketing") {
    if (data.startDate && !dateIsAllowed(data.startDate, existing?.startDate ?? "")) return fail("Start date cannot be before today.");
    if (!dateIsAllowed(data.dueDate, existing?.dueDate ?? "")) return fail("Due date cannot be before today.");
  }
  if (existing) Object.assign(existing, { ...data, department, assignees });
  else await Milestone.create({ ...data, department, assignees, projectId: project._id });
  if (existing) await existing.save();

  // Anyone named on a milestone joins that part of the team.
  const lane = department === "marketing" ? "marketingAssignees" : "assignees";
  project[lane] = [...new Set([...project[lane], ...assignees])];
  await project.save();
  await syncProjectStatus(project._id);

  revalidatePath("/projects");
  revalidatePath(`/projects/${code}`);
  return done(existing ? "Milestone saved." : "Milestone added.");
}

export async function deleteMilestoneAction(code: string, id: string): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const project = await findProject(user, code);
  const milestone = project && isId(id) ? await Milestone.findOne({ _id: id, projectId: project._id }) : null;
  if (!project || !milestone) return fail("Milestone not found.");
  if (!canManageDepartment(user.role, project.type, milestone.department)) return fail("You cannot delete this milestone.");
  await Task.deleteMany({ milestoneId: milestone._id });
  await milestone.deleteOne();
  await syncProjectStatus(project._id);
  await writeAudit(user.username, "milestone.deleted", { code, milestone: milestone.title });
  revalidatePath("/projects");
  revalidatePath(`/projects/${code}`);
  return done("Milestone deleted.");
}
