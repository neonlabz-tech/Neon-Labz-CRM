"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { requireAction } from "@/lib/auth";
import { issueCode, nextSeq } from "@/lib/counters";
import { connectDb } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { done, fail, invalid } from "@/lib/form";
import { isId, validEmployeeCodes, visibleProjectFilter } from "@/lib/project-access";
import { issueSchema } from "@/schemas/issue";
import { Issue } from "@/models/issue";
import { Project } from "@/models/project";
import type { ActionState } from "@/types";

export async function saveIssueAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("issues.manage");
  const parsed = issueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  if (!(await Project.exists({ code: data.projectCode, archived: false, ...(await visibleProjectFilter(user)) }))) {
    return { ok: false, message: "Choose a project from the list.", errors: { projectCode: "Choose a project from the list." } };
  }
  if (data.assignee && !(await validEmployeeCodes([data.assignee])).length) {
    return { ok: false, message: "Choose an active employee.", errors: { assignee: "Choose an active employee." } };
  }
  if (id) {
    const result = isId(id) ? await Issue.updateOne({ _id: id, createdBy: user.username }, data) : { matchedCount: 0 };
    if (!result.matchedCount) return fail("That issue was not found.");
  } else {
    await Issue.create({ ...data, code: issueCode(await nextSeq("issue")), reportedAt: todayISO(), createdBy: user.username });
  }
  await writeAudit(user.username, id ? "issue.updated" : "issue.created", { project: data.projectCode });
  revalidatePath("/issues");
  redirect("/issues");
}

export async function deleteIssueAction(id: string): Promise<ActionState> {
  const user = await requireAction("issues.manage");
  await connectDb();
  const result = isId(id) ? await Issue.deleteOne({ _id: id, createdBy: user.username }) : { deletedCount: 0 };
  if (!result.deletedCount) return fail("That issue was not found.");
  await writeAudit(user.username, "issue.deleted", { id });
  revalidatePath("/issues");
  return done("Issue deleted.");
}
