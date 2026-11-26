"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Notice } from "@/models/notice";

export async function markNoticesReadAction() {
  const user = await requireUser();
  await connectDb();
  await Notice.updateMany({ to: user.username, read: false }, { read: true });
  revalidatePath("/", "layout");
}

/** Opening a project clears that project's unread notifications for the person. */
export async function markProjectNoticesReadAction(code: string) {
  const user = await requireUser();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(code)) return;
  await connectDb();
  const result = await Notice.updateMany({ to: user.username, link: `/projects/${code}`, $or: [{ read: false }, { projectSeen: false }] }, { read: true, projectSeen: true });
  if (result.modifiedCount > 0) revalidatePath("/", "layout");
}

/** One notification becomes read when the person opens it. */
export async function markNoticeReadAction(id: string) {
  const user = await requireUser();
  if (!isValidObjectId(id)) return;
  await connectDb();
  await Notice.updateOne({ _id: id, to: user.username, read: false }, { read: true });
  revalidatePath("/", "layout");
}
