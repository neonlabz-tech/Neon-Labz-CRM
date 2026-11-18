"use server";

import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { done, fail } from "@/lib/form";
import { APPROVAL_STATUS, PUBLISH_STATUS, TRACK_FIELDS, type TrackField } from "@/lib/content-tracker";
import { contentTypeNames } from "@/lib/content-tracker-data";
import { findProject, isId } from "@/lib/project-access";
import { teamMembersFor } from "@/lib/team";
import { ContentItem, ContentTypeOption } from "@/models/content-track";
import type { ActionState } from "@/types";

type Input = { projectCode: string; planId: string; slot: string; field: string; value: string };

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Saves one cell of the Content Tracker. Only the Marketing team can use it, and only on the projects it can see. */
export async function saveContentFieldAction(input: Input): Promise<ActionState> {
  const user = await requireAction("content.track");
  const { projectCode, planId, slot, field } = input;
  const value = typeof input.value === "string" ? input.value : "";
  if (typeof projectCode !== "string" || !isId(planId) || !/^\d{1,3}-\d{1,4}$/.test(slot ?? "") || !(TRACK_FIELDS as readonly string[]).includes(field)) return fail("That row could not be found.");
  const project = await findProject(user, projectCode);
  if (!project || project.type === "software") return fail("Project not found.");

  const key = field as TrackField;
  if (key === "approval" && !(APPROVAL_STATUS as readonly string[]).includes(value)) return fail("Choose Pending or Approved.");
  if (key === "publishStatus" && !(PUBLISH_STATUS as readonly string[]).includes(value)) return fail("Choose Pending or Approved.");
  if (key === "scheduleDate" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail("Choose a valid date.");
  if (key === "caption" && value.length > 2200) return fail("The caption can be up to 2200 characters.");
  if (key === "assignee" && value && !(await teamMembersFor("marketing")).some((m) => m.username === value)) return fail("Choose someone from the Marketing team.");
  if (key === "contentType" && value && !(await contentTypeNames()).includes(value)) return fail("Choose a content type from the list.");

  await connectDb();
  const result = await ContentItem.updateOne({ projectCode, planId, slot }, { [key]: value });
  if (!result.matchedCount) return fail("That row could not be found. Reload the page and try again.");
  return done("Saved.");
}

const cleanName = (name: unknown) => (typeof name === "string" ? name : "").replace(/\s+/g, " ").trim();

/** Renames a Content Type everywhere it is used. */
export async function renameContentTypeAction(id: string, name: string): Promise<ActionState> {
  await requireAction("content.track");
  const clean = cleanName(name);
  if (!isId(id)) return fail("That content type could not be found.");
  if (clean.length < 2 || clean.length > 40) return fail("The content type must be 2 to 40 characters.");
  await connectDb();
  const current = await ContentTypeOption.findById(id).select("name").lean();
  if (!current) return fail("That content type could not be found.");
  const clash = await ContentTypeOption.findOne({ _id: { $ne: id }, name: new RegExp(`^${escapeRegex(clean)}$`, "i") }).select("_id").lean();
  if (clash) return fail("There is already a content type with that name.");
  await ContentTypeOption.updateOne({ _id: id }, { name: clean });
  await ContentItem.updateMany({ contentType: current.name }, { contentType: clean });
  return done("Renamed.");
}

/** Deletes a Content Type. Rows that used it go back to "Select type". */
export async function deleteContentTypeAction(id: string): Promise<ActionState> {
  await requireAction("content.track");
  if (!isId(id)) return fail("That content type could not be found.");
  await connectDb();
  const current = await ContentTypeOption.findById(id).select("name").lean();
  if (!current) return fail("That content type could not be found.");
  const cleared = await ContentItem.updateMany({ contentType: current.name }, { contentType: "" });
  await ContentTypeOption.deleteOne({ _id: id });
  return done(cleared.modifiedCount ? `Deleted. Cleared from ${cleared.modifiedCount} row${cleared.modifiedCount === 1 ? "" : "s"}.` : "Deleted.");
}

/** Adds a Content Type to the dropdown for everyone. On success the message is the name to use (an existing one when it was already there). */
export async function addContentTypeAction(name: string): Promise<ActionState & { id?: string }> {
  await requireAction("content.track");
  const clean = (typeof name === "string" ? name : "").replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > 40) return fail("The content type must be 2 to 40 characters.");
  await connectDb();
  await contentTypeNames();
  const existing = await ContentTypeOption.findOne({ name: new RegExp(`^${escapeRegex(clean)}$`, "i") }).select("name").lean();
  if (existing) return { ...done(existing.name), id: String(existing._id) };
  await ContentTypeOption.create({ name: clean }).catch(() => undefined);
  const saved = await ContentTypeOption.findOne({ name: new RegExp(`^${escapeRegex(clean)}$`, "i") }).select("name").lean();
  return saved ? { ...done(saved.name), id: String(saved._id) } : fail("The content type could not be added.");
}
