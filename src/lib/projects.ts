import type { Role } from "./permissions";

export const PROJECT_TYPES = ["software", "marketing", "both"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export const DEPARTMENTS = ["software", "marketing"] as const;
export type Department = (typeof DEPARTMENTS)[number];
export const PROJECT_STATUS = { "in-progress": "In progress", completed: "Completed", "on-hold": "On hold" } as const;
export const MILESTONE_STATUS = { pending: "Pending", "in-progress": "In progress", "at-risk": "At risk", done: "Done" } as const;
export const TASK_STATUS = { "not-started": "To Do", "in-progress": "In Progress", completed: "Ready for review", done: "Done" } as const;
export const PRIORITY = { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as const;

export type TaskStatus = keyof typeof TASK_STATUS;
export type MilestoneStatus = keyof typeof MILESTONE_STATUS;

/** The status a person sees. On a project with both parts, the Project Manager sees the software part and Marketing the marketing part; everyone else sees the whole project. */
export function statusFor(role: Role, project: { status: string; type: string; softwareStatus?: string | null; marketingStatus?: string | null }): string {
  if (project.type !== "both" || project.status === "on-hold") return project.status;
  if (role === "pm") return project.softwareStatus ?? project.status;
  if (role === "marketing") return project.marketingStatus ?? project.status;
  return project.status;
}

/** "Software Completed · Marketing In progress" for a project with both parts that is not on hold; empty otherwise. */
export function partsLine(project: { status: string; type: string; softwareStatus?: string | null; marketingStatus?: string | null }): string {
  if (project.type !== "both" || project.status === "on-hold") return "";
  const label = (value?: string | null) => PROJECT_STATUS[(value ?? project.status) as keyof typeof PROJECT_STATUS];
  return `Software ${label(project.softwareStatus)} · Marketing ${label(project.marketingStatus)}`;
}

export const defaultDepartment = (type: ProjectType): Department => (type === "marketing" ? "marketing" : "software");

/** Project managers run software work, marketing runs marketing work, the Super Admin runs everything. */
export function canEditProjectShell(role: Role, type: ProjectType): boolean {
  if (role === "superadmin") return true;
  if (role === "pm") return type !== "marketing";
  if (role === "marketing") return type === "marketing";
  return false;
}

export function canManageDepartment(role: Role, type: ProjectType, department: Department): boolean {
  if (role === "superadmin") return true;
  if (role === "pm") return type !== "marketing" && department === "software";
  if (role === "marketing") return type !== "software" && department === "marketing";
  return false;
}

/** Employees can set To Do, In Progress and Completed. Only a manager can mark a task Done. */
export function employeeMayMove(current: TaskStatus, next: TaskStatus): boolean {
  return current !== "done" && next !== "done";
}

/** A milestone is finished when it has tasks and every one of them is Done; otherwise it is In progress once any task has started, and Pending before that. */
export function nextMilestoneStatus(current: MilestoneStatus, taskStatuses: TaskStatus[]): MilestoneStatus {
  const complete = taskStatuses.length > 0 && taskStatuses.every((s) => s === "done");
  if (complete) return "done";
  if (current === "at-risk") return current;
  return taskStatuses.some((s) => s !== "not-started") ? "in-progress" : "pending";
}

/** Stamps the completed and done times the same way the old board did. */
export function stampTask(status: TaskStatus, previous: { completedAt?: Date | null; doneAt?: Date | null } = {}) {
  const now = new Date();
  if (status === "completed") return { completedAt: previous.completedAt ?? now, doneAt: null };
  if (status === "done") return { completedAt: previous.completedAt ?? now, doneAt: previous.doneAt ?? now };
  return { completedAt: null, doneAt: null };
}
