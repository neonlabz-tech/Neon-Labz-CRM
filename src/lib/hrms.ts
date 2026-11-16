export const MEMBER_TYPES = [
  { id: "admin", label: "Admin" },
  { id: "team", label: "Team member" },
] as const;
export const DEPARTMENT_KINDS = [
  { role: "pm", label: "Project manager", prefix: "PM" },
  { role: "marketing", label: "Marketing admin", prefix: "MD" },
  { role: "sales", label: "Sales admin", prefix: "SD" },
] as const;
export const LEAVE_TYPES = ["Medical Leave", "Casual Leave", "Annual Leave", "Short Leave", "Non-approved Leave"] as const;
export const HR_ROLES = ["Intern", "Trainee", "Junior", "Associate", "Senior", "Manager", "Custom Role"] as const;
export const ACTIVITY_CATEGORIES = ["Sports Event", "Team Meeting", "Office Celebration", "Company Function"] as const;
export const EMPLOYMENT_STATUSES = ["Active", "Resigned", "Terminated"] as const;
export const ACTIVITY_STATUSES = ["Scheduled", "Completed"] as const;
