"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { done, fail, invalid } from "@/lib/form";
import { deleteFromR2 } from "@/lib/r2";
import { uploadFile } from "@/lib/uploads";
import { packageSchema } from "@/schemas/package";
import { Package } from "@/models/package";
import type { ActionState } from "@/types";

export async function savePackageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("packages.manage");
  const parsed = packageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;

  await connectDb();
  const existing = id ? await Package.findById(id).select("cover").lean() : null;
  if (id && !existing) return fail("That package was not found.");

  const upload = await uploadFile(formData.get("cover"), "packages", { images: true, maxMb: 3, what: "cover image" });
  if (upload.error) return fail(upload.error);
  const cover = upload.url || (formData.get("removeCover") === "on" ? "" : existing?.cover ?? "");

  if (id) await Package.updateOne({ _id: id }, { ...data, cover });
  else await Package.create({ ...data, cover });
  if (existing?.cover && existing.cover !== cover) await deleteFromR2(existing.cover);
  await writeAudit(user.username, id ? "package.updated" : "package.created", { name: data.name });
  revalidatePath("/packages");
  redirect("/packages");
}

export async function setPackageStatusAction(id: string, status: "active" | "archived"): Promise<ActionState> {
  const user = await requireAction("packages.manage");
  await connectDb();
  const result = await Package.updateOne({ _id: id }, { status });
  if (!result.matchedCount) return fail("That package was not found.");
  await writeAudit(user.username, status === "archived" ? "package.archived" : "package.restored", { id });
  revalidatePath("/packages");
  return done(status === "archived" ? "Package archived." : "Package is active again.");
}

export async function deletePackageAction(id: string): Promise<ActionState> {
  const user = await requireAction("packages.manage");
  await connectDb();
  const pkg = await Package.findByIdAndDelete(id).select("cover").lean();
  if (!pkg) return fail("That package was not found.");
  if (pkg.cover) await deleteFromR2(pkg.cover);
  await writeAudit(user.username, "package.deleted", { id });
  revalidatePath("/packages");
  return done("Package deleted.");
}
