"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { audienceFitMessage, audienceFits, type Audience } from "@/lib/audience";
import { requireAction } from "@/lib/auth";
import { issueCode, nextSeq } from "@/lib/counters";
import { connectDb } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { done, fail, invalid } from "@/lib/form";
import { isId, validEmployeeCodes, visibleProjectFilter } from "@/lib/project-access";
import type { ProjectType } from "@/lib/projects";
import { issueSchema } from "@/schemas/issue";
import { Issue } from "@/models/issue";
import { Project } from "@/models/project";
import type { ActionState } from "@/types";

/** The issues a person may change: the Super Admin any; a PM or MD their own, plus the ones the Super Admin sent to their team. */
function reach(user: { role: string; username: string }, id: string) {
  if (user.role === "superadmin") return { _id: id };
  const team = user.role === "pm" ? "pm" : user.role === "marketing" ? "marketing" : "";
  return { _id: id, $or: [{ createdBy: user.username }, ...(team ? [{ audience: { $in: [team, "both"] } }] : [])] };
}

export async function saveIssueAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("issues.manage");
  const parsed = issueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, audience: sent, ...data } = parsed.data;
  const admin = user.role === "superadmin";
  await connectDb();
  const project = await Project.findOne({ code: data.projectCode, archived: false, ...(await visibleProjectFilter(user)) }).select("type").lean();
  if (!project) {
    return { ok: false, message: "Choose a project from the list.", errors: { projectCode: "Choose a project from the list." } };
  }
  // Only the Super Admin chooses a team; it has to be one that works on this project.
  const audience: Audience = sent || "both";
  if (admin && !audienceFits(project.type as ProjectType, audience)) {
    const message = audienceFitMessage(project.type as ProjectType);
    return { ok: false, message, errors: { audience: message } };
  }
  if (data.assignee && !(await validEmployeeCodes([data.assignee])).length) {
    return { ok: false, message: "Choose an active employee.", errors: { assignee: "Choose an active employee." } };
  }
  if (id) {
    const result = isId(id) ? await Issue.updateOne(reach(user, id), admin ? { ...data, audience } : data) : { matchedCount: 0 };
    if (!result.matchedCount) return fail("That issue was not found.");
  } else {
    await Issue.create({ ...data, code: issueCode(await nextSeq("issue")), reportedAt: todayISO(), createdBy: user.username, audience: admin ? audience : "" });
  }
  await writeAudit(user.username, id ? "issue.updated" : "issue.created", { project: data.projectCode });
  revalidatePath("/issues");
  redirect("/issues");
}

export async function deleteIssueAction(id: string): Promise<ActionState> {
  const user = await requireAction("issues.manage");
  await connectDb();
  const result = isId(id) ? await Issue.deleteOne(reach(user, id)) : { deletedCount: 0 };
  if (!result.deletedCount) return fail("That issue was not found.");
  await writeAudit(user.username, "issue.deleted", { id });
  revalidatePath("/issues");
  return done("Issue deleted.");
}
