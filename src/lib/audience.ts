import type { Role } from "./permissions";
import type { ProjectType } from "./projects";

/** Who the Super Admin sends a meeting, milestone or issue to. Pick one team, or both. */
export const AUDIENCES = { pm: "Project Manager (Software)", marketing: "Marketing Head (MD)", both: "Both teams" } as const;
export type Audience = keyof typeof AUDIENCES;
export const AUDIENCE_KEYS = ["pm", "marketing", "both"] as const;
export const AUDIENCE_SHORT = { pm: "PM", marketing: "MD", both: "Both" } as const;

/** A project of one kind can only be sent to the team that works on it. "Both teams" always fits (it means every team on the project). */
export function audienceFits(type: ProjectType, audience: Audience): boolean {
  return audience === "both" || (audience === "pm" ? type !== "marketing" : type !== "software");
}

export const audienceFitMessage = (type: ProjectType) =>
  type === "marketing" ? "This is a Marketing project, so choose Marketing Head (MD) or Both teams." : "This is a Software project, so choose Project Manager (Software) or Both teams.";

/** Records with no audience (made by a PM, MD or before this existed) behave as they always did. */
export function sentToFilter(role: Role): Record<string, unknown> {
  if (role !== "pm" && role !== "marketing") return {};
  return { $or: [{ audience: { $in: [null, ""] } }, { audience: { $in: [role === "pm" ? "pm" : "marketing", "both"] } }] };
}
