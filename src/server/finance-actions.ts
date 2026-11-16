"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/finance";
import { done, fail, invalid } from "@/lib/form";
import { isId } from "@/lib/project-access";
import { categorySchema, expenseSchema, payrollSchema, revenueSchema } from "@/schemas/finance";
import { Expense, ExpenseCategory, Payroll, Revenue } from "@/models/finance";
import { Employee } from "@/models/hrms";
import { User } from "@/models/user";
import type { ActionState } from "@/types";

const field = (name: string, message: string): ActionState => ({ ok: false, message, errors: { [name]: message } });

export async function savePayrollAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("finance.view");
  const parsed = payrollSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  const month = data.date.slice(0, 7);
  await connectDb();
  if (!isId(data.employee) || !(await Employee.exists({ _id: data.employee }))) return field("employee", "Choose an employee.");
  if (await Payroll.exists({ employee: data.employee, month, ...(id && isId(id) ? { _id: { $ne: id } } : {}) })) {
    return field("date", "This employee already has a payroll record for that month. Edit that one instead.");
  }
  if (id) {
    const result = isId(id) ? await Payroll.updateOne({ _id: id }, { ...data, month }) : { matchedCount: 0 };
    if (!result.matchedCount) return fail("That payment was not found.");
  } else {
    await Payroll.create({ ...data, month });
  }
  await writeAudit(admin.username, id ? "finance.payroll.updated" : "finance.payroll.created", { month });
  revalidatePath("/finance", "layout");
  redirect("/finance/payroll");
}

export async function saveExpenseAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("finance.view");
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  const custom = (await ExpenseCategory.find().select("name").lean()).map((c) => c.name);
  if (![...DEFAULT_CATEGORIES, ...custom].includes(data.category)) return field("category", "Choose a category.");
  if (id) {
    const result = isId(id) ? await Expense.updateOne({ _id: id }, data) : { matchedCount: 0 };
    if (!result.matchedCount) return fail("That expense was not found.");
  } else {
    await Expense.create(data);
  }
  await writeAudit(admin.username, id ? "finance.expense.updated" : "finance.expense.created", { category: data.category });
  revalidatePath("/finance", "layout");
  redirect("/finance/expenses");
}

export async function deleteExpenseAction(id: string): Promise<ActionState> {
  const admin = await requireAction("finance.view");
  await connectDb();
  const result = isId(id) ? await Expense.deleteOne({ _id: id }) : { deletedCount: 0 };
  if (!result.deletedCount) return fail("That expense was not found.");
  await writeAudit(admin.username, "finance.expense.deleted", { id });
  revalidatePath("/finance", "layout");
  return done("Expense deleted.");
}

export async function addCategoryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("finance.view");
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const name = parsed.data.name;
  await connectDb();
  const taken = [...DEFAULT_CATEGORIES, "Salary", ...(await ExpenseCategory.find().select("name").lean()).map((c) => c.name)];
  if (taken.some((c) => c.toLowerCase() === name.toLowerCase())) return field("name", "This category already exists.");
  await ExpenseCategory.create({ name });
  await writeAudit(admin.username, "finance.category.created", { name });
  revalidatePath("/finance", "layout");
  redirect("/finance/expenses");
}

export async function saveRevenueAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAction("finance.view");
  const parsed = revenueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...data } = parsed.data;
  await connectDb();
  if (data.salesPerson && !(await User.exists({ username: data.salesPerson, role: "sales" }))) return field("salesPerson", "Choose a sales person from the list.");
  if (id) {
    const result = isId(id) ? await Revenue.updateOne({ _id: id }, data) : { matchedCount: 0 };
    if (!result.matchedCount) return fail("That revenue record was not found.");
  } else {
    await Revenue.create(data);
  }
  await writeAudit(admin.username, id ? "finance.revenue.updated" : "finance.revenue.created", { amount: data.amount });
  revalidatePath("/finance", "layout");
  redirect("/finance/revenue");
}

export async function deleteRevenueAction(id: string): Promise<ActionState> {
  const admin = await requireAction("finance.view");
  await connectDb();
  const result = isId(id) ? await Revenue.deleteOne({ _id: id }) : { deletedCount: 0 };
  if (!result.deletedCount) return fail("That revenue record was not found.");
  await writeAudit(admin.username, "finance.revenue.deleted", { id });
  revalidatePath("/finance", "layout");
  return done("Revenue deleted.");
}
