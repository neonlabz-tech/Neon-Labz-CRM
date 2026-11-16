import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { connectDb } from "./db";
import { env } from "./env";
import { writeAudit } from "./audit";
import { can, type Action, type Role } from "./permissions";
import { User } from "@/models/user";
import type { SessionUser } from "@/types";

const SESSION_COOKIE = "neon_session";
const SESSION_DAYS = 7;

const key = () => new TextEncoder().encode(env.jwtSecret());

export const hashPassword = (value: string) => bcrypt.hash(value, 10);
export const verifyPassword = (value: string, hash: string) => bcrypt.compare(value, hash);

export async function createSession(username: string, role: Role) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let username = "";
  try {
    username = (await jwtVerify(token, key())).payload.sub ?? "";
  } catch {
    return null;
  }
  await connectDb();
  const user = await User.findOne({ username, active: true })
    .select("username role fullName email mustChangePassword")
    .lean();
  if (!user) return null;
  return {
    username: user.username,
    role: user.role,
    fullName: user.fullName ?? "",
    email: user.email ?? "",
    mustChangePassword: user.mustChangePassword,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAction(action: Action): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, action)) {
    await writeAudit(user.username, "permission.denied", { action });
    notFound();
  }
  return user;
}

export async function ensureSeed() {
  await connectDb();
  if (await User.exists({ role: "superadmin" })) return;
  await User.create({
    username: "SA_001",
    role: "superadmin",
    passwordHash: await hashPassword(env.seedPassword()),
    mustChangePassword: true,
  });
  await writeAudit("system", "seed.superadmin", { username: "SA_001" });
}
