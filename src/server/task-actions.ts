"use server";

import { cleanRich } from "@/lib/rich-text";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { nextSeq, taskCode } from "@/lib/counters";
import { done, fail, invalid } from "@/lib/form";
import { notifyRole, notifyUsers } from "@/lib/notify";
import { employeeOnMilestone, findProject, isId, marketingUsernames, recomputeMilestone, validEmployeeCodes } from "@/lib/project-access";
import { can } from "@/lib/permissions";
import { canManageDepartment, employeeMayMove, stampTask, TASK_STATUS, type TaskStatus } from "@/lib/projects";
import { taskSchema } from "@/schemas/project";
import { Milestone } from "@/models/milestone";
import { Task } from "@/models/task";
import type { ActionState } from "@/types";

function refresh(code: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${code}`);
  revalidatePath("/my-work");
}

export async function saveTaskAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "employee" && !can(user.role, "projects.manage")) return fail("You cannot change tasks.");
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, projectCode: code, milestoneId, ...data } = { ...parsed.data, description: cleanRich(parsed.data.description) };

  const project = await findProject(user, code);
  const milestone = project && isId(milestoneId) ? await Milestone.findOne({ _id: milestoneId, projectId: project._id }) : null;
  if (!project || !milestone) return fail("Project or milestone not found.");
  const existing = id && isId(id) ? await Task.findOne({ _id: id, projectId: project._id }) : null;
  if (id && !existing) return fail("Task not found.");

  // Task dates must stay inside the milestone's own start and due dates (only checked when the date is new or changed).
  const outside = (d: string) => Boolean(d) && ((milestone.startDate && d < milestone.startDate) || (milestone.dueDate && d > milestone.dueDate));
  const range = `${milestone.startDate || "…"} → ${milestone.dueDate || "…"}`;
  if (data.startDate && data.startDate !== existing?.startDate && outside(data.startDate)) return fail(`Start date must be within the milestone dates (${range}).`);
  if (data.dueDate && data.dueDate !== existing?.dueDate && outside(data.dueDate)) return fail(`Due date must be within the milestone dates (${range}).`);

  const lane = milestone.department;
  let assigneeCode = data.assigneeCode;
  let status = data.status as TaskStatus;

  if (user.role === "employee") {
    if (!employeeOnMilestone(user.username, milestone, project)) return fail("This milestone is not assigned to you.");
    if (milestone.status === "done") return fail("This milestone is finished. Wait for the next assignment.");
    if (existing && existing.assigneeCode !== user.username) return fail("This task belongs to another employee.");
    if (existing?.status === "done") return fail("The project manager has already marked this task done.");
    if (!employeeMayMove(existing?.status as TaskStatus ?? "not-started", status)) return fail("Only the project manager can mark a task Done.");
    assigneeCode = user.username;
  } else {
    if (!canManageDepartment(user.role, project.type, lane)) return fail("You cannot manage tasks in this part of the project.");
    if (assigneeCode && !(await validEmployeeCodes([assigneeCode])).length) return fail("Choose an active employee.");
    if (assigneeCode && (await marketingUsernames()).has(assigneeCode) !== (lane === "marketing")) return fail(lane === "marketing" ? "Choose an employee from the marketing team." : "Choose an employee from the software team.");
    if (assigneeCode && milestone.assignees.length && !milestone.assignees.includes(assigneeCode)) return fail("Assign that employee to this milestone first.");
  }

  await connectDb();
  const fields = { ...data, status, assigneeCode, department: lane, milestoneId: milestone._id, projectId: project._id, ...stampTask(status, existing ?? {}) };
  const before = existing?.status;
  let saved;
  if (existing) {
    Object.assign(existing, fields);
    saved = await existing.save();
  } else {
    saved = await Task.create({ ...fields, code: taskCode(await nextSeq("task")), createdBy: user.username });
  }
  await recomputeMilestone(milestone._id);

  if (user.role !== "employee" && assigneeCode && assigneeCode !== existing?.assigneeCode) {
    await notifyUsers([assigneeCode], `${user.username} assigned you “${saved.title}” on ${project.name}.`, "/my-work");
  }
  if (user.role !== "employee" && status === "done" && existing?.status !== "done" && assigneeCode) {
    await notifyUsers([assigneeCode], `${user.username} marked “${saved.title}” as done.`, "/my-work");
  }
  if (user.role !== "employee" && before === "done" && status !== "done" && assigneeCode) {
    await notifyUsers([assigneeCode], `${user.username} moved “${saved.title}” back to ${TASK_STATUS[status]}.`, "/my-work");
  }
  if (before && before !== status) {
    await writeAudit(user.username, "task.status", { task: saved.title, project: project.name, milestone: milestone.title, from: before, to: status });
  }
  if (user.role === "employee" && lane === "marketing") await notifyRole("marketing", `${user.username} updated work on ${project.name}.`, `/projects/${code}`);

  refresh(code);
  return done(existing ? "Task saved." : "Task added.");
}

export async function moveTaskAction(code: string, taskId: string, status: TaskStatus): Promise<ActionState> {
  const user = await requireUser();
  if (!(status in TASK_STATUS) || !isId(taskId)) return fail("That move is not allowed.");
  const project = await findProject(user, code);
  const task = project ? await Task.findOne({ _id: taskId, projectId: project._id }) : null;
  const milestone = task ? await Milestone.findById(task.milestoneId) : null;
  if (!project || !task || !milestone) return fail("Task not found.");

  if (user.role === "employee") {
    if (task.assigneeCode !== user.username) return fail("This task belongs to another employee.");
    if (milestone.status === "done") return fail("This milestone is finished.");
    if (!employeeMayMove(task.status as TaskStatus, status)) return fail("Only the project manager can mark a task Done.");
  } else if (!canManageDepartment(user.role, project.type, task.department)) {
    return fail("You cannot manage tasks in this part of the project.");
  }

  const before = task.status;
  Object.assign(task, { status, ...stampTask(status, task) });
  await task.save();
  await recomputeMilestone(milestone._id);
  await writeAudit(user.username, "task.status", { task: task.title, project: project.name, milestone: milestone.title, from: before, to: status });
  if (user.role !== "employee" && status === "done" && before !== "done" && task.assigneeCode) {
    await notifyUsers([task.assigneeCode], `${user.username} marked “${task.title}” as done.`, "/my-work");
  }
  if (user.role !== "employee" && before === "done" && status !== "done" && task.assigneeCode) {
    await notifyUsers([task.assigneeCode], `${user.username} moved “${task.title}” back to ${TASK_STATUS[status]}.`, "/my-work");
  }
  if (user.role === "employee" && task.department === "marketing") await notifyRole("marketing", `${user.username} moved “${task.title}” to ${TASK_STATUS[status]}.`, `/projects/${code}`);
  refresh(code);
  return done(`Moved to ${TASK_STATUS[status]}.`);
}

export async function deleteTaskAction(code: string, taskId: string): Promise<ActionState> {
  const user = await requireUser();
  const project = await findProject(user, code);
  const task = project && isId(taskId) ? await Task.findOne({ _id: taskId, projectId: project._id }) : null;
  if (!project || !task) return fail("Task not found.");
  if (user.role === "employee" || !canManageDepartment(user.role, project.type, task.department)) return fail("You cannot delete this task.");
  await task.deleteOne();
  await recomputeMilestone(task.milestoneId);
  await writeAudit(user.username, "task.deleted", { code: task.code });
  refresh(code);
  return done("Task deleted.");
}
