import "server-only";
import { connectDb } from "./db";
import type { Role } from "./permissions";
import { Notice } from "@/models/notice";
import { User } from "@/models/user";

export async function notifyUsers(usernames: string[], text: string, link = "") {
  if (!usernames.length) return;
  await connectDb();
  await Notice.insertMany(usernames.map((to) => ({ to, text, link })));
}

export async function notifyRole(role: Role, text: string, link = "") {
  await connectDb();
  const users = await User.find({ role, active: true }).select("username").lean();
  await notifyUsers(users.map((u) => u.username), text, link);
}

/** Tell the PM for software work, the MD for marketing work, or both for a mix. */
export async function notifyWork(type: string, text: string, link = "") {
  if (type !== "marketing") await notifyRole("pm", text, link);
  if (type !== "software") await notifyRole("marketing", text, link);
}
