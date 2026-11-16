import "server-only";
import { connectDb } from "./db";
import type { Role } from "./permissions";
import { Department, Employee } from "@/models/hrms";

/** Active team members a manager can assign work to. Marketing sees its own departments; PMs see everyone else. */
export async function teamMembersFor(role: Role) {
  await connectDb();
  const departments = await Department.find().select("role").lean();
  const marketing = departments.filter((d) => d.role === "marketing").map((d) => d._id);
  const own = departments.filter((d) => d.role === role).map((d) => d._id);
  const filter = role === "marketing" ? { department: { $in: marketing } } : own.length ? { department: { $in: own } } : { department: { $nin: marketing } };
  return Employee.find({ memberType: "team", status: "Active", ...filter }).select("username name").sort({ name: 1 }).lean();
}
