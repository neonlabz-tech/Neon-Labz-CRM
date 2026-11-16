"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLogin, passwordFields } from "@/lib/accounts";
import { writeAudit } from "@/lib/audit";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { done, fail, invalid } from "@/lib/form";
import { isId } from "@/lib/project-access";
import { activitySchema, departmentSchema, employeeSchema, leaveSchema } from "@/schemas/hrms";
import { Payroll } from "@/models/finance";
import { Activity, Department, Employee, Leave } from "@/models/hrms";
import { User } from "@/models/user";
import type { ActionState } from "@/types";

const dup = (field: string, message: string): ActionState => ({ ok: false, message, errors: { [field]: message } });

export async function saveDepartmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAction("hrms.manage");
  const parsed = departmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  const taken = await Department.findOne({ name: data.name, ...(id && isId(id) ? { _id: { $ne: id } } : {}) }).collation({ locale: "en", strength: 2 }).select("_id").lean();
  if (taken) return dup("name", "A department with this name already exists.");
  if (id) {
    const existing = isId(id) ? await Department.findById(id) : null;
    if (!existing) return fail("That department was not found.");
    if (existing.role !== data.role && (await Employee.exists({ department: existing._id }))) {
      return dup("role", "This department already has people, so its admin sign-in cannot change.");
    }
    existing.set(data);
    await existing.save();
  } else {
    await Department.create(data);
  }
  await writeAudit(user.username, id ? "hrms.department.updated" : "hrms.department.created", { name: data.name });
  revalidatePath("/hrms", "layout");
  redirect("/hrms/departments");
}

export async function deleteDepartmentAction(id: string): Promise<ActionState> {
  const user = await requireAction("hrms.manage");
  await connectDb();
  if (!isId(id)) return fail("That department was not found.");
  if (await Employee.exists({ department: id })) return fail("Remove the people in this department before deleting it.");
  const result = await Department.deleteOne({ _id: id });
  if (!result.deletedCount) return fail("That department was not found.");
  await writeAudit(user.username, "hrms.department.deleted", { id });
  revalidatePath("/hrms", "layout");
  return done("Department deleted.");
}

export async function saveEmployeeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("hrms.manage");
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, password, confirm: _confirm, role, customRole, ...data } = parsed.data;
  const title = role === "Custom Role" ? customRole : role;
  await connectDb();
  if (await Employee.exists({ email: data.email, ...(id && isId(id) ? { _id: { $ne: id } } : {}) })) {
    return dup("email", "This email is already assigned to an employee.");
  }

  if (id) {
    const existing = isId(id) ? await Employee.findById(id) : null;
    if (!existing) return fail("That employee was not found.");
    existing.set({ name: data.name, email: data.email, phone: data.phone, join: data.join, title, status: data.status });
    await existing.save();
    const login: Record<string, unknown> = { fullName: data.name, email: data.email, phone: data.phone, active: data.status === "Active" };
    if (password) Object.assign(login, { ...(await passwordFields(password)), mustChangePassword: true });
    await User.updateOne({ username: existing.username }, login);
    await writeAudit(admin.username, "hrms.employee.updated", { username: existing.username });
  } else {
    const department = isId(data.department) ? await Department.findById(data.department).select("role").lean() : null;
    if (!department) return dup("department", "Choose a department. Add the department before adding people.");
    const username = await createLogin(data.memberType === "admin" ? department.role : "employee", data.name, password, { email: data.email, phone: data.phone });
    if (data.status !== "Active") await User.updateOne({ username }, { active: false });
    await Employee.create({ ...data, title, username });
    await writeAudit(admin.username, "hrms.employee.created", { username });
  }
  revalidatePath("/hrms", "layout");
  revalidatePath("/users");
  redirect("/hrms");
}

export async function deleteEmployeeAction(id: string): Promise<ActionState> {
  const admin = await requireAction("hrms.manage");
  await connectDb();
  const employee = isId(id) ? await Employee.findById(id) : null;
  if (!employee) return fail("That employee was not found.");
  if ((await Leave.exists({ employee: id })) || (await Payroll.exists({ employee: id }))) {
    return fail("This employee has leave or payroll records. Change their employment status to keep the history.");
  }
  await Employee.deleteOne({ _id: id });
  await User.deleteOne({ username: employee.username });
  await writeAudit(admin.username, "hrms.employee.deleted", { username: employee.username });
  revalidatePath("/hrms", "layout");
  revalidatePath("/users");
  return done("Employee deleted.");
}

export async function saveLeaveAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("hrms.manage");
  const parsed = leaveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  if (!isId(data.employee) || !(await Employee.exists({ _id: data.employee }))) return dup("employee", "Select a valid employee.");
  if (id) {
    const result = isId(id) ? await Leave.updateOne({ _id: id }, data) : { matchedCount: 0 };
    if (!result.matchedCount) return fail("That leave record was not found.");
  } else {
    await Leave.create(data);
  }
  await writeAudit(admin.username, id ? "hrms.leave.updated" : "hrms.leave.created", { employee: data.employee });
  revalidatePath("/hrms", "layout");
  redirect("/hrms/leaves");
}

export async function deleteLeaveAction(id: string): Promise<ActionState> {
  const admin = await requireAction("hrms.manage");
  await connectDb();
  const result = isId(id) ? await Leave.deleteOne({ _id: id }) : { deletedCount: 0 };
  if (!result.deletedCount) return fail("That leave record was not found.");
  await writeAudit(admin.username, "hrms.leave.deleted", { id });
  revalidatePath("/hrms", "layout");
  return done("Leave record deleted.");
}

export async function saveActivityAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("hrms.manage");
  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  if (id) {
    const result = isId(id) ? await Activity.updateOne({ _id: id }, data) : { matchedCount: 0 };
    if (!result.matchedCount) return fail("That activity was not found.");
  } else {
    await Activity.create(data);
  }
  await writeAudit(admin.username, id ? "hrms.activity.updated" : "hrms.activity.created", { name: data.name });
  revalidatePath("/hrms", "layout");
  redirect("/hrms/activities");
}

export async function deleteActivityAction(id: string): Promise<ActionState> {
  const admin = await requireAction("hrms.manage");
  await connectDb();
  const result = isId(id) ? await Activity.deleteOne({ _id: id }) : { deletedCount: 0 };
  if (!result.deletedCount) return fail("That activity was not found.");
  await writeAudit(admin.username, "hrms.activity.deleted", { id });
  revalidatePath("/hrms", "layout");
  return done("Activity deleted.");
}
