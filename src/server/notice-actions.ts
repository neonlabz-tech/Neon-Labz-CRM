"use server";

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
