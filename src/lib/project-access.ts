import "server-only";
import mongoose, { isValidObjectId } from "mongoose";
import { connectDb } from "./db";
import { nextMilestoneStatus, type MilestoneStatus, type TaskStatus } from "./projects";
import { USERNAME_PATTERN, type Role } from "./permissions";
import { Client } from "@/models/client";
import { Department, Employee } from "@/models/hrms";
import { Milestone } from "@/models/milestone";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { User } from "@/models/user";
import type { SessionUser } from "@/types";

/** True for a well-formed record id, so a bad id from a form or a link is rejected before it reaches the database. */
export function isId(value: unknown): value is string {
  return typeof value === "string" && isValidObjectId(value);
}

/** Codes of the projects that are in History. Their sprints, milestones, issues and reports stay out of the lists until the project is moved back to active. */
export async function historyProjectCodes(): Promise<string[]> {
  await connectDb();
  return Project.distinct("code", { archived: true });
}

/** Record ids of the projects in History, for hiding their tasks from the lists. */
export async function historyProjectIds(): Promise<mongoose.Types.ObjectId[]> {
  await connectDb();
  return (await Project.distinct("_id", { archived: true })) as mongoose.Types.ObjectId[];
}

/** Client codes whose projects are all in History (the client has at least one project and none is active). Marketing documents of these clients stay out of the lists until a project is moved back to active. */
export async function historyClientCodes(): Promise<string[]> {
  await connectDb();
  const rows = await Project.aggregate<{ _id: string }>([
    { $group: { _id: "$clientCode", active: { $max: { $cond: [{ $ne: ["$archived", true] }, 1, 0] } } } },
    { $match: { active: 0 } },
  ]);
  return rows.map((r) => r._id).filter(Boolean);
}

/** Which projects a person may see. Employees only see work they are assigned to. */
async function ownOnlyClientCodes(): Promise<string[]> {
  await connectDb();
  return Client.distinct("code", { ownOnly: true });
}

export async function visibleProjectFilter(user: Pick<SessionUser, "role" | "username">): Promise<Record<string, unknown>> {
  switch (user.role) {
    case "superadmin":
      return {};
    // A client the Super Admin keeps for themselves (Goes to = Own) has projects only the Super Admin sees.
    case "pm":
      return { type: { $in: ["software", "both"] }, clientCode: { $nin: await ownOnlyClientCodes() } };
    case "marketing":
      return { type: { $in: ["marketing", "both"] }, clientCode: { $nin: await ownOnlyClientCodes() } };
    case "employee": {
      await connectDb();
      const viaMilestone = await Milestone.distinct("projectId", { assignees: user.username });
      return { archived: false, $or: [{ assignees: user.username }, { marketingAssignees: user.username }, { _id: { $in: viaMilestone } }] };
    }
    default:
      return { _id: null };
  }
}

/**
 * What the Super Admin sees when picking one account: that account's own projects, plus (for a Marketing account) every project that has a
 * marketing part, because Marketing works on those even when the Project Manager started them.
 */
export function accountFilter(account: string): Record<string, unknown> {
  // The whole PM or MD team: every project that has that team's part.
  if (account === "PM") return { type: { $in: ["software", "both"] } };
  if (account === "MD") return { type: { $in: ["marketing", "both"] } };
  return account.startsWith("MD_") ? { $or: [{ owner: account }, { type: "both" }] } : { owner: account };
}

/** True for the whole Marketing team ("MD") or one Marketing account ("MD_001"). */
export function isMarketingAccount(account: string): boolean {
  return account === "MD" || account.startsWith("MD_");
}

export async function findProject(user: Pick<SessionUser, "role" | "username">, code: string) {
  await connectDb();
  return Project.findOne({ code, ...(await visibleProjectFilter(user)) });
}

/** Logins a milestone or a task can go to: employees, plus Project Managers and Marketing heads. */
const ASSIGNABLE_ROLES: Array<"employee" | "pm" | "marketing"> = ["employee", "pm", "marketing"];

/**
 * Keeps only real, active logins that `by` may assign work to. Everyone may pick employees; the Super Admin may also pick any
 * Project Manager or Marketing head; a Project Manager or Marketing head may pick only themselves.
 */
export async function validEmployeeCodes(codes: string[], by?: Pick<SessionUser, "role" | "username">): Promise<string[]> {
  const wanted = [...new Set(codes.filter((c) => USERNAME_PATTERN.test(c)))];
  if (!wanted.length) return [];
  await connectDb();
  const rows = await User.find({ username: { $in: wanted }, role: { $in: ASSIGNABLE_ROLES }, active: true }).select("username role").lean();
  return rows.filter((r) => r.role === "employee" || by?.role === "superadmin" || r.username === by?.username).map((r) => r.username);
}

/** Everyone work can be assigned to: employees first, then Project Managers, then Marketing heads. */
export async function activeEmployees() {
  await connectDb();
  const rows = await User.find({ role: { $in: ASSIGNABLE_ROLES }, active: true }).select("username fullName role").sort({ username: 1 }).lean();
  const rank = (role: string) => (ASSIGNABLE_ROLES as string[]).indexOf(role);
  return rows.sort((a, b) => rank(a.role) - rank(b.role) || a.username.localeCompare(b.username));
}

/** An employee works on a milestone when it names them, or names nobody and they are on that team. */
export function employeeOnMilestone(
  username: string,
  milestone: { assignees: string[]; department: "software" | "marketing" },
  project: { assignees: string[]; marketingAssignees: string[] }
): boolean {
  if (milestone.assignees.length) return milestone.assignees.includes(username);
  return (milestone.department === "marketing" ? project.marketingAssignees : project.assignees).includes(username);
}

export async function recomputeMilestone(milestoneId: mongoose.Types.ObjectId) {
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) return;
  const statuses = (await Task.find({ milestoneId }).select("status").lean()).map((t) => t.status as TaskStatus);
  const next = nextMilestoneStatus(milestone.status as MilestoneStatus, statuses);
  if (next !== milestone.status) {
    milestone.status = next;
    await milestone.save();
  }
  await syncProjectStatus(milestone.projectId);
}

/**
 * Each part of a project is Completed once it has milestones and every one is Done, and goes back to In progress when a milestone is added,
 * reopened or removed. The whole project is Completed when every part it has is. On hold and archived projects keep their own status.
 */
export async function syncProjectStatus(projectId: mongoose.Types.ObjectId) {
  const project = await Project.findById(projectId).select("type status archived softwareStatus marketingStatus").lean();
  if (!project) return;
  const milestones = await Milestone.find({ projectId }).select("department status").lean();
  const partDone = (part: string) => {
    const mine = milestones.filter((m) => m.department === part);
    return mine.length > 0 && mine.every((m) => m.status === "done");
  };
  const softwareStatus = partDone("software") ? "completed" : "in-progress";
  const marketingStatus = partDone("marketing") ? "completed" : "in-progress";
  const parts = project.type === "both" ? ["software", "marketing"] : [project.type];
  const finished = parts.every(partDone);
  const update: Record<string, string> = {};
  if (softwareStatus !== project.softwareStatus) update.softwareStatus = softwareStatus;
  if (marketingStatus !== project.marketingStatus) update.marketingStatus = marketingStatus;
  if (!project.archived && (project.status === "in-progress" || project.status === "completed")) {
    const next = finished ? "completed" : "in-progress";
    if (next !== project.status) update.status = next;
  }
  if (Object.keys(update).length) await Project.updateOne({ _id: projectId }, update);
}

/** Logins on the marketing side: employees in a Marketing department, and the Marketing heads (MD). Everyone else is on the software side. */
export async function marketingUsernames(): Promise<Set<string>> {
  await connectDb();
  const departments = await Department.find({ role: "marketing" }).select("_id").lean();
  const rows = departments.length ? await Employee.find({ department: { $in: departments.map((d) => d._id) } }).select("username").lean() : [];
  const heads = await User.find({ role: "marketing" }).select("username").lean();
  return new Set([...rows.map((r) => r.username), ...heads.map((h) => h.username)]);
}
