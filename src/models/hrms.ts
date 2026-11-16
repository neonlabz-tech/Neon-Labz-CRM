import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUSES, EMPLOYMENT_STATUSES, LEAVE_TYPES } from "@/lib/hrms";

const department = new mongoose.Schema(
  { name: { type: String, required: true, trim: true }, role: { type: String, enum: ["pm", "marketing", "sales"], required: true } },
  { timestamps: true }
);
department.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

const employee = new mongoose.Schema(
  {
    /** The login username, for example EMP_001 for a team member. */
    username: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, required: true },
    join: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: EMPLOYMENT_STATUSES, default: "Active", index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    memberType: { type: String, enum: ["admin", "team"], required: true },
  },
  { timestamps: true }
);
employee.index({ name: 1 });

const leave = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    date: { type: String, required: true, index: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    description: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const activity = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ACTIVITY_CATEGORIES, required: true },
    date: { type: String, required: true, index: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: ACTIVITY_STATUSES, default: "Scheduled" },
  },
  { timestamps: true }
);

export type DepartmentDoc = InferSchemaType<typeof department>;
export type EmployeeDoc = InferSchemaType<typeof employee>;
export type LeaveDoc = InferSchemaType<typeof leave>;
export type ActivityDoc = InferSchemaType<typeof activity>;

export const Department: Model<DepartmentDoc> = (mongoose.models.Department as Model<DepartmentDoc>) || mongoose.model<DepartmentDoc>("Department", department);
export const Employee: Model<EmployeeDoc> = (mongoose.models.Employee as Model<EmployeeDoc>) || mongoose.model<EmployeeDoc>("Employee", employee);
export const Leave: Model<LeaveDoc> = (mongoose.models.Leave as Model<LeaveDoc>) || mongoose.model<LeaveDoc>("Leave", leave);
export const Activity: Model<ActivityDoc> = (mongoose.models.Activity as Model<ActivityDoc>) || mongoose.model<ActivityDoc>("Activity", activity);
