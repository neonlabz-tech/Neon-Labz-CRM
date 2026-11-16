"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { done, fail, invalid } from "@/lib/form";
import { firstMatch, upcomingDate } from "@/lib/meetings";
import { findProject, isId } from "@/lib/project-access";
import { meetingSchema } from "@/schemas/meeting";
import { Meeting } from "@/models/meeting";
import type { ActionState } from "@/types";

export async function saveMeetingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  const parsed = meetingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, status, ...data } = parsed.data;

  const project = await findProject(user, data.projectCode);
  if (!project || project.archived) return fail("Choose an active project.");
  const existing = id && isId(id) ? await Meeting.findById(id) : null;
  if (id && !existing) return fail("Meeting not found.");

  await connectDb();
  const startDate = firstMatch(data);
  if (existing) {
    // The status chosen in the form belongs to the next date still scheduled, as before the change.
    const target = upcomingDate(existing);
    const statusByDate = { ...(existing.statusByDate as Record<string, string>), [target]: status };
    existing.set({ ...data, startDate, statusByDate });
    existing.markModified("statusByDate");
    await existing.save();
  } else {
    await Meeting.create({ ...data, startDate, createdBy: user.username });
  }
  await writeAudit(user.username, existing ? "meeting.updated" : "meeting.created", { project: data.projectCode });
  revalidatePath("/sprints");
  redirect("/sprints");
}

export async function deleteMeetingAction(id: string): Promise<ActionState> {
  const user = await requireAction("projects.manage");
  await connectDb();
  const meeting = isId(id) ? await Meeting.findById(id) : null;
  if (!meeting || !(await findProject(user, meeting.projectCode))) return fail("Meeting not found.");
  await meeting.deleteOne();
  await writeAudit(user.username, "meeting.deleted", { project: meeting.projectCode });
  revalidatePath("/sprints");
  return done("Meeting deleted.");
}
