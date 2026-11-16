import "server-only";
import { connectDb } from "./db";
import { visibleProjectFilter } from "./project-access";
import { Project } from "@/models/project";
import type { SessionUser } from "@/types";

/** Projects a manager can attach a report to, plus a code-to-name lookup for the list. */
export async function reportProjects(user: Pick<SessionUser, "role" | "username">) {
  await connectDb();
  const projects = await Project.find({ archived: false, ...(await visibleProjectFilter(user)) }).select("code name").sort({ name: 1 }).limit(300).lean();
  return { projects: projects.map((p) => ({ code: p.code, name: p.name })), names: new Map(projects.map((p) => [p.code, p.name])) };
}
