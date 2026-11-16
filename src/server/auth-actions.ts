"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { passwordFields } from "@/lib/accounts";
import { connectDb } from "@/lib/db";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import {
  createSession, destroySession, ensureSeed, getCurrentUser, requireUser, verifyPassword,
} from "@/lib/auth";
import { done, fail, invalid } from "@/lib/form";
import { roleFromUsername } from "@/lib/permissions";
import { changePasswordSchema, forgotSchema, loginSchema, resetPasswordSchema } from "@/schemas/auth";
import { User } from "@/models/user";
import { Audit } from "@/models/audit";
import { PasswordReset } from "@/models/password-reset";
import type { ActionState } from "@/types";

const LINK_MINUTES = 30;
const REQUEST_DAYS = 7;
const MAX_FAILED = 10;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const GENERIC_RESET = "If this account can be reset, the request has been received.";

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { username, password } = parsed.data;
  try {
    await connectDb();
  } catch (error) {
    console.error("Database connection failed", error);
    return fail("Cannot reach the database. Check MONGODB_URI in .env.local and your internet connection.");
  }
  await ensureSeed();
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const failures = await Audit.countDocuments({ actor: username, action: "login.failed", createdAt: { $gt: since } });
  if (failures >= MAX_FAILED) return fail("Too many sign-in attempts. Try again in a few minutes.");

  const user = await User.findOne({ username }).select("+passwordHash username role active mustChangePassword").lean();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await writeAudit(username, "login.failed", { reason: user ? "password" : "unknown-user" });
    return fail("Username or password is incorrect.");
  }
  if (!user.active) return fail("This account is switched off. Ask the Super Admin to turn it on.");
  await createSession(user.username, user.role);
  await writeAudit(user.username, "login.ok");
  redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await writeAudit(user.username, "logout");
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const user = await User.findOne({ username: me.username }).select("+passwordHash");
  if (!user || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { ok: false, message: "Your current password is not correct.", errors: { current: "Your current password is not correct." } };
  }
  Object.assign(user, await passwordFields(parsed.data.next), { mustChangePassword: false });
  await user.save();
  await writeAudit(me.username, "password.changed");
  if (me.mustChangePassword) redirect("/dashboard");
  return done("Your password has been changed.");
}

export async function forgotPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  await connectDb();
  const value = parsed.data.identifier;

  if (value.includes("@")) {
    // The reset link goes to the address in SUPERADMIN_EMAIL (in .env.local), or to the email saved on the Super Admin account.
    const adminEmail = env.superadminEmail();
    const isAdminEmail = adminEmail !== "" && value.toLowerCase() === adminEmail;
    const user = await User.findOne({ role: "superadmin", active: true, ...(isAdminEmail ? {} : { email: value.toLowerCase() }) }).sort({ username: 1 }).select("username").lean();
    if (user) {
      const token = randomBytes(32).toString("hex");
      await PasswordReset.updateMany({ username: user.username, purpose: "superadmin-link", status: "open" }, { status: "completed", usedAt: new Date() });
      const row = await PasswordReset.create({
        username: user.username, purpose: "superadmin-link", tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + LINK_MINUTES * 60 * 1000),
      });
      const link = `${env.appUrl().replace(/\/$/, "")}/reset/${token}`;
      try {
        await sendMail(
          value.toLowerCase(),
          "Reset your NeonLabz password",
          `Open this link to set a new password. It works once and expires in ${LINK_MINUTES} minutes:\n${link}\n\nIf you did not ask for this, ignore this email.`,
          `<p>Open the link below to set a new password. It works once and expires in ${LINK_MINUTES} minutes.</p><p><a href="${link}">Set a new password</a></p><p>If you did not ask for this, ignore this email.</p>`
        );
        await writeAudit(user.username, "password.reset.email_sent");
      } catch {
        await PasswordReset.deleteOne({ _id: row._id });
        await writeAudit("system", "password.reset.email_failed", { username: user.username });
        return fail("The reset email could not be sent. Check the email settings and try again.");
      }
    }
    return done(GENERIC_RESET);
  }

  const username = value.toUpperCase();
  const role = roleFromUsername(username);
  if (role && role !== "superadmin" && (await User.exists({ username, active: true }))) {
    const open = await PasswordReset.exists({ username, purpose: "staff-request", status: "open", expiresAt: { $gt: new Date() } });
    if (!open) {
      await PasswordReset.create({ username, purpose: "staff-request", expiresAt: new Date(Date.now() + REQUEST_DAYS * 86400000) });
      await writeAudit(username, "password.reset.requested");
    }
  }
  return done(GENERIC_RESET);
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  await connectDb();
  const row = await PasswordReset.findOne({ tokenHash: hashToken(parsed.data.token), purpose: "superadmin-link", status: "open" });
  const user = row && row.expiresAt.getTime() > Date.now() ? await User.findOne({ username: row.username, role: "superadmin" }) : null;
  if (!row || !user) return fail("This reset link is not valid or has expired.");
  Object.assign(user, await passwordFields(parsed.data.next), { mustChangePassword: false });
  await user.save();
  await PasswordReset.updateMany({ username: user.username, purpose: "superadmin-link", status: "open" }, { status: "completed", usedAt: new Date() });
  await writeAudit(user.username, "password.reset.completed");
  redirect("/login");
}
