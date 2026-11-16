"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { done, fail, invalid } from "@/lib/form";
import { deleteFromR2 } from "@/lib/r2";
import { uploadFile } from "@/lib/uploads";
import { clientContactsSchema } from "@/schemas/client";
import { Client } from "@/models/client";
import { Project } from "@/models/project";
import type { ActionState } from "@/types";

export async function saveClientLogoAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("clients.view");
  const code = String(formData.get("code") ?? "");
  await connectDb();
  const client = await Client.findOne({ code }).select("logo").lean();
  if (!client) return fail("Client not found.");

  const remove = formData.get("removeLogo") === "on";
  const upload = await uploadFile(formData.get("logo"), "logos", { images: true, maxMb: 2, what: "logo" });
  if (upload.error) return fail(upload.error);
  if (!upload.url && !remove) return fail("Choose a logo to upload.");

  const logo = upload.url || "";
  await Client.updateOne({ code }, { logo });
  if (client.logo) await deleteFromR2(client.logo);
  await writeAudit(user.username, "client.logo", { code });
  revalidatePath("/clients");
  return done(logo ? "Logo saved." : "Logo removed.");
}

/** The main person, an assigned person, contact details and any sub contacts of a paying client. */
export async function saveClientContactsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("clients.view");
  const { logo: file, removeLogo, ...fields } = Object.fromEntries(formData);
  const parsed = clientContactsSchema.safeParse(fields);
  if (!parsed.success) return invalid(parsed.error);
  const { code, email, phone, workType, ...rest } = parsed.data;
  await connectDb();
  const existing = await Client.findOne({ code }).select("logo").lean();
  if (!existing) return fail("Client not found.");
  // A new file replaces the old logo; the box removes it; otherwise the logo stays as it is.
  const upload = await uploadFile(file ?? null, "logos", { images: true, maxMb: 2, what: "logo" });
  if (upload.error) return fail(upload.error);
  const logoChange = upload.url ? { logo: upload.url } : removeLogo === "on" ? { logo: "" } : {};
  // Only the Super Admin and the Project Manager may change which work a client has, since that decides who sees the client.
  const canSetWork = user.role === "superadmin" || user.role === "pm";
  const result = await Client.updateOne({ code }, { ...rest, ...logoChange, email, phone, ...(canSetWork && workType ? { workType } : {}) });
  if (!result.matchedCount) return fail("Client not found.");
  if ("logo" in logoChange && existing.logo) await deleteFromR2(existing.logo);
  await Project.updateMany({ clientCode: code }, { clientName: rest.name });
  await writeAudit(user.username, "client.update", { code });
  revalidatePath("/clients");
  revalidatePath("/projects");
  return done("Client saved.");
}
