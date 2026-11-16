"use server";

import { revalidatePath } from "next/cache";
import { connectDb } from "@/lib/db";
import { requireAction, verifyPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { done, fail, invalid } from "@/lib/form";
import { createLogin, passwordFields } from "@/lib/accounts";
import { open } from "@/lib/secrets";
import { roleFromUsername } from "@/lib/permissions";
import { createUserSchema, profileSchema } from "@/schemas/user";
import { MIN_PASSWORD } from "@/schemas/auth";
import { User } from "@/models/user";
import { PasswordReset } from "@/models/password-reset";
import type { ActionState } from "@/types";

export async function createUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("users.manage");
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  await connectDb();
  const username = await createLogin(parsed.data.role, parsed.data.fullName, parsed.data.password);
  await writeAudit(admin.username, "user.created", { username });
  revalidatePath("/users");
  return done(`${username} was created. Share the temporary password privately.`);
}

/** The Super Admin must give their own password before a login is shown or changed. */
async function adminConfirmed(admin: { username: string }, password: string): Promise<boolean> {
  const me = await User.findOne({ username: admin.username }).select("+passwordHash").lean();
  return Boolean(me && password && (await verifyPassword(password, me.passwordHash)));
}

export async function verifyAdminPasswordAction(password: string): Promise<ActionState> {
  const admin = await requireAction("users.manage");
  await connectDb();
  return (await adminConfirmed(admin, password.trim())) ? done("Confirmed.") : fail("Password is incorrect.");
}

export async function revealPasswordAction(username: string, password: string): Promise<ActionState & { password?: string }> {
  const admin = await requireAction("users.manage");
  await connectDb();
  if (!(await adminConfirmed(admin, password.trim()))) {
    await writeAudit(admin.username, "password.view.denied", { username });
    return fail("Password is incorrect.");
  }
  if (username === admin.username) return fail("Your own password is not shown here. Use My account to change it.");
  const user = await User.findOne({ username }).select("+passwordVault").lean();
  const shown = user?.passwordVault ? open(user.passwordVault) : "";
  if (!shown) return fail("This password was saved before viewing was enabled. Set a new temporary password, then it can be viewed.");
  await writeAudit(admin.username, "password.view.revealed", { username });
  return { ok: true, message: "Password shown.", password: shown };
}

export async function saveAccountAction(username: string, adminPassword: string, input: { active: boolean; password: string; confirm: string }): Promise<ActionState> {
  const admin = await requireAction("users.manage");
  await connectDb();
  if (!(await adminConfirmed(admin, adminPassword.trim()))) return fail("Password is incorrect.");
  const next = input.password.trim();
  if (next && next.length < MIN_PASSWORD) return fail(`Use at least ${MIN_PASSWORD} characters for the password.`);
  if (next !== input.confirm.trim()) return fail("Passwords do not match.");
  const user = await User.findOne({ username, role: { $ne: "superadmin" } });
  if (!user) return fail("That account was not found.");
  user.active = input.active;
  if (next) Object.assign(user, await passwordFields(next), { mustChangePassword: true });
  await user.save();
  if (next) await PasswordReset.updateMany({ username, purpose: "staff-request", status: "open" }, { status: "completed", usedAt: new Date() });
  await writeAudit(admin.username, next ? "password.reset.issued" : "user.updated", { username });
  revalidatePath("/users");
  return done(next ? `${username} saved. They must change the temporary password when they sign in.` : `${username} saved.`);
}

export async function deleteUserAction(username: string): Promise<ActionState> {
  const admin = await requireAction("users.manage");
  const role = roleFromUsername(username);
  if (!role || role === "superadmin") return fail("This account cannot be deleted.");
  await connectDb();
  const result = await User.deleteOne({ username, role: { $ne: "superadmin" } });
  if (!result.deletedCount) return fail("That account was not found.");
  await PasswordReset.deleteMany({ username });
  await writeAudit(admin.username, "user.deleted", { username });
  revalidatePath("/users");
  return done(`${username} was deleted.`);
}

export async function updateProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("users.manage");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  await connectDb();
  if (await User.exists({ email: parsed.data.email, username: { $ne: admin.username } })) {
    return { ok: false, message: "That email is already used by another account.", errors: { email: "That email is already used by another account." } };
  }
  await User.updateOne({ username: admin.username }, parsed.data);
  await writeAudit(admin.username, "profile.updated");
  revalidatePath("/account");
  return done("Profile saved. Password reset emails will go to this address.");
}
