import "server-only";
import { hashPassword } from "@/lib/auth";
import { seal } from "@/lib/secrets";
import { usernameFor, type Role } from "@/lib/permissions";
import { User } from "@/models/user";

async function nextUsername(role: Role) {
  const prefix = usernameFor(role, 0).slice(0, -3);
  const rows = await User.find({ role }).select("username").lean();
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.username.replace(prefix, "")) || 0), 0);
  return usernameFor(role, highest + 1);
}

/** The stored form of a new password: a hash to sign in with and an encrypted copy the Super Admin can view. */
export async function passwordFields(password: string) {
  return { passwordHash: await hashPassword(password), passwordVault: seal(password), passwordUpdatedAt: new Date() };
}

/** Creates a login with a temporary password the person must change at first sign-in. */
export async function createLogin(role: Exclude<Role, "superadmin">, fullName: string, password: string, extra: { email?: string; phone?: string } = {}) {
  const username = await nextUsername(role);
  await User.create({ username, role, fullName, ...extra, ...(await passwordFields(password)), mustChangePassword: true });
  return username;
}
