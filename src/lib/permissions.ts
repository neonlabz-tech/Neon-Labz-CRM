export const ROLES = ["superadmin", "pm", "marketing", "sales", "employee"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super Admin",
  pm: "Project Manager",
  marketing: "Marketing",
  sales: "Sales",
  employee: "Employee",
};

const PREFIX: Record<Role, string> = { superadmin: "SA", pm: "PM", marketing: "MD", sales: "SD", employee: "EMP" };

export const USERNAME_PATTERN = /^(SA|PM|MD|SD|EMP)_\d{3}$/;

export function roleFromUsername(username: string): Role | null {
  const value = username.trim().toUpperCase();
  if (!USERNAME_PATTERN.test(value)) return null;
  return ROLES.find((role) => value.startsWith(`${PREFIX[role]}_`)) ?? null;
}

export function usernameFor(role: Role, number: number) {
  return `${PREFIX[role]}_${String(number).padStart(3, "0")}`;
}

export const ACTIONS = {
  "users.manage": ["superadmin"],
  "audit.view": ["superadmin"],
  "reports.company": ["superadmin"],
  "finance.view": ["superadmin"],
  "hrms.manage": ["superadmin"],
  "packages.manage": ["superadmin"],
  "packages.view": ["superadmin", "sales"],
  "own.view": ["superadmin"],
  "special.manage": ["superadmin"],
  "payments.record": ["sales", "superadmin"],
  "sales.targets": ["superadmin"],
  "targets.own": ["sales"],
  "targets.view": ["superadmin", "sales"],
  "leads.manage": ["superadmin", "sales"],
  "leads.delete": ["superadmin"],
  "leads.export": ["superadmin"],
  "payments.export": ["superadmin"],
  "payments.submit": ["sales"],
  "payments.approve": ["superadmin"],
  "quotations.manage": ["superadmin", "sales"],
  "clients.view": ["superadmin", "pm", "marketing"],
  "clients.delete": ["superadmin"],
  "projects.view": ["superadmin", "pm", "marketing"],
  "projects.manage": ["superadmin", "pm", "marketing"],
  "marketing.manage": ["superadmin", "marketing"],
  "marketing.view": ["superadmin", "pm", "marketing"],
  "marketing.monitor": ["pm"],
  "content.track": ["superadmin", "marketing"],
  "content.sidebar": ["marketing"],
  "content.tab": ["superadmin"],
  "issues.manage": ["superadmin", "pm", "marketing"],
  "reports.manage": ["superadmin", "pm"],
  "tasks.work": ["employee", "pm", "marketing"],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof ACTIONS;

export function can(role: Role, action: Action): boolean {
  return (ACTIONS[action] as readonly Role[]).includes(role);
}

/** Sales see only their own leads, quotations and payments; the Super Admin sees everything. */
export function ownerScope(user: { role: Role; username: string }): Record<string, string> {
  return user.role === "sales" ? { owner: user.username } : {};
}
