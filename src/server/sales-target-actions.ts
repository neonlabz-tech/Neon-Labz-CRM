"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { done, fail, invalid } from "@/lib/form";
import { salesSettingsSchema, staffTargetSchema } from "@/schemas/sales-target";
import { SalesSetting, SalesTarget } from "@/models/sales-target";
import { User } from "@/models/user";
import type { ActionState } from "@/types";

export async function saveStaffTargetAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("sales.targets");
  const parsed = staffTargetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { username, ...data } = parsed.data;
  await connectDb();
  if (!(await User.exists({ username, role: "sales", active: true }))) return fail("That salesperson was not found.");
  await SalesTarget.updateOne({ username }, { $set: data }, { upsert: true });
  await writeAudit(admin.username, "sales.target.saved", { username });
  revalidatePath("/sales-team");
  revalidatePath("/dashboard");
  redirect("/sales-team");
}

export async function saveSalesSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("sales.targets");
  const parsed = salesSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  await connectDb();
  await SalesSetting.updateOne({ key: "sales" }, { $set: parsed.data }, { upsert: true });
  await writeAudit(admin.username, "sales.settings.saved", {});
  revalidatePath("/sales-settings");
  revalidatePath("/dashboard");
  return done("Settings saved.");
}
