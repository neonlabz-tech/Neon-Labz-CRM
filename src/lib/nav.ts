import { can, type Action, type Role } from "./permissions";

export type IconName = "search" | "dashboard" | "users" | "audit" | "account" | "leads" | "quotes" | "payments" | "approvals" | "clients" | "packages" | "projects" | "work" | "info" | "plans" | "hrms" | "finance" | "issues" | "productivity" | "activity" | "reports" | "mreports" | "notifications";
/** `scoped` tabs carry the area's team (PM or MD) so the page shows only that team's work. */
type Tab = { href: string; label: string; action?: Action; scoped?: boolean };
/** One sidebar entry. Its tabs are shown at the top of every page inside it. */
type Area = {
  title: string; icon: IconName; action?: Action; own?: boolean; tabs: Tab[];
  /** Name shown in the sidebar when it differs from the title for some roles. */
  label?: (role: Role) => string;
  /** Only these roles see the area / these roles do not. */
  roles?: Role[]; hideFor?: Role[];
  /** The Super Admin's PM and MD areas show one team's work. */
  scope?: "PM" | "MD";
};
type AreaGroup = { title: string; areas: Area[] };

export type NavItem = { href: string; label: string; icon: IconName; own: boolean; scope: "PM" | "MD" | ""; match: string[]; tabs: { href: string; label: string; scoped: boolean }[] };
export type NavGroup = { title: string; items: NavItem[] };

const GROUPS: AreaGroup[] = [
  { title: "Main", areas: [{ title: "Dashboard", icon: "dashboard", tabs: [{ href: "/dashboard", label: "Dashboard" }] }] },
  {
    title: "Work",
    areas: [
      {
        title: "Sales", icon: "leads", label: (role) => (role === "superadmin" ? "SD View" : "Sales"),
        tabs: [
          { href: "/sales-overview", label: "Overview", action: "sales.targets" },
          { href: "/leads", label: "Leads", action: "leads.manage" },
          { href: "/quotations", label: "Quotations", action: "quotations.manage" },
          { href: "/payments", label: "Payments", action: "payments.submit" },
          { href: "/approvals", label: "Approvals", action: "payments.approve" },
          { href: "/sales-reports", label: "Reports", action: "sales.targets" },
          { href: "/sales-team", label: "Team", action: "sales.targets" },
          { href: "/sales-commission", label: "Commission", action: "sales.targets" },
          { href: "/sales-settings", label: "Settings", action: "sales.targets" },
        ],
      },
      {
        title: "Targets & Commission", icon: "productivity",
        tabs: [
          { href: "/my-targets", label: "Targets & Commission", action: "targets.own" },
          { href: "/my-targets/history", label: "History", action: "targets.own" },
        ],
      },
      {
        title: "Projects", icon: "projects", hideFor: ["superadmin"],
        tabs: [
          { href: "/projects", label: "Projects", action: "projects.view" },
          { href: "/sprints", label: "Sprints", action: "projects.view" },
          { href: "/milestones", label: "Milestones", action: "projects.view" },
          { href: "/issues", label: "Issues", action: "issues.manage" },
          { href: "/reports", label: "Reports", action: "reports.manage" },
        ],
      },
      {
        title: "PM View", icon: "projects", roles: ["superadmin"], scope: "PM",
        tabs: [
          { href: "/projects", label: "Projects", action: "projects.view", scoped: true },
          { href: "/sprints", label: "Sprints", action: "projects.view", scoped: true },
          { href: "/milestones", label: "Milestones", action: "projects.view", scoped: true },
          { href: "/issues", label: "Issues", action: "issues.manage", scoped: true },
          { href: "/reports", label: "Reports", action: "reports.manage", scoped: true },
        ],
      },
      {
        title: "MD View", icon: "info", roles: ["superadmin"], scope: "MD",
        tabs: [
          { href: "/projects", label: "Projects", action: "projects.view", scoped: true },
          { href: "/sprints", label: "Sprints", action: "projects.view", scoped: true },
          { href: "/milestones", label: "Milestones", action: "projects.view", scoped: true },
          { href: "/issues", label: "Issues", action: "issues.manage", scoped: true },
          { href: "/marketing/info", label: "Client info", action: "marketing.view" },
          { href: "/marketing/plans", label: "Content plans", action: "marketing.view" },
          { href: "/marketing/reports", label: "Reports", action: "marketing.view" },
          { href: "/content-tracker", label: "Content Tracker", action: "content.tab" },
        ],
      },
      {
        title: "Own projects", icon: "clients", own: true,
        tabs: [
          { href: "/projects", label: "Projects", action: "own.view" },
          { href: "/leads", label: "Leads", action: "own.view" },
          { href: "/quotations", label: "Quotations", action: "own.view" },
          { href: "/clients", label: "Clients", action: "own.view" },
          { href: "/payments", label: "Payments", action: "own.view" },
          { href: "/marketing/info", label: "Client info", action: "own.view" },
          { href: "/marketing/plans", label: "Content plans", action: "own.view" },
          { href: "/marketing/reports", label: "Marketing reports", action: "own.view" },
        ],
      },
      {
        title: "My work", icon: "work",
        tabs: [
          { href: "/my-work", label: "Tasks", action: "tasks.work" },
          { href: "/productivity", label: "Productivity", action: "tasks.work" },
          { href: "/activity", label: "My activity", action: "tasks.work" },
        ],
      },
      {
        title: "Marketing", icon: "info", hideFor: ["superadmin"],
        tabs: [
          { href: "/marketing/info", label: "Client info", action: "marketing.view" },
          { href: "/marketing/plans", label: "Content plans", action: "marketing.view" },
          { href: "/marketing/reports", label: "Reports", action: "marketing.view" },
          { href: "/marketing/progress", label: "Progress", action: "marketing.monitor" },
          { href: "/content-tracker", label: "Content Tracker", action: "content.tab" },
        ],
      },
      {
        title: "Content Tracker", icon: "plans", action: "content.sidebar",
        tabs: [{ href: "/content-tracker", label: "Content Tracker", action: "content.track" }],
      },
      {
        title: "Special Clients", icon: "users", action: "special.manage",
        tabs: [
          { href: "/special-clients", label: "Clients" },
          { href: "/special-clients/quotations", label: "Quotations" },
          { href: "/special-clients/proposals", label: "Proposals" },
          { href: "/special-clients/srs", label: "SRS documents" },
          { href: "/special-clients/info", label: "Client info" },
        ],
      },
    ],
  },
  {
    title: "Company",
    areas: [
      { title: "Clients", icon: "clients", tabs: [{ href: "/clients", label: "Clients", action: "clients.view" }] },
      { title: "Packages", icon: "packages", tabs: [{ href: "/packages", label: "Packages", action: "packages.view" }] },
      { title: "Finance", icon: "finance", tabs: [{ href: "/finance", label: "Finance", action: "finance.view" }] },
      { title: "HR", icon: "hrms", tabs: [{ href: "/hrms", label: "HR", action: "hrms.manage" }] },
    ],
  },
  {
    title: "Admin",
    areas: [
      { title: "People & logins", icon: "users", tabs: [{ href: "/users", label: "People & logins", action: "users.manage" }] },
      { title: "Reports", icon: "mreports", tabs: [{ href: "/company-reports", label: "Reports", action: "reports.company" }] },
      { title: "Activity log", icon: "audit", tabs: [{ href: "/audit", label: "Activity log", action: "audit.view" }] },
    ],
  },
  { title: "Account", areas: [{ title: "Notifications", icon: "notifications", tabs: [{ href: "/notifications", label: "Notifications" }] }, { title: "My account", icon: "account", tabs: [{ href: "/account", label: "My account" }] }] },
];

export function navFor(role: Role): NavGroup[] {
  return GROUPS.map((group) => ({
    title: group.title,
    items: group.areas.flatMap((area): NavItem[] => {
      if ((area.roles && !area.roles.includes(role)) || area.hideFor?.includes(role)) return [];
      const scope = area.scope ?? "";
      const tabs = area.tabs.filter((tab) => !tab.action || can(role, tab.action)).map(({ href, label, scoped }) => ({ href, label, scoped: Boolean(scoped) }));
      const first = tabs[0];
      if (!first || (area.action && !can(role, area.action))) return [];
      const own = Boolean(area.own);
      const query = own ? "?own=1" : scope && first.scoped ? `?pm=${scope}` : "";
      return [{ href: `${first.href}${query}`, label: area.label?.(role) ?? area.title, icon: area.icon, own, scope, match: tabs.map((t) => t.href), tabs: tabs.length > 1 ? tabs : [] }];
    }),
  })).filter((group) => group.items.length > 0);
}

/**
 * The sidebar entry the person is in. The PM and MD areas of the Super Admin share some pages (Projects, Sprints, ...),
 * so the team in the address (pm=PM or pm=MD, or an account of that team) tells them apart.
 */
export function activeItem(groups: NavGroup[], path: string, own: boolean, pm: string): NavItem | undefined {
  const hits = groups.flatMap((g) => g.items).filter((i) => i.own === own && i.match.some((m) => path === m || path.startsWith(`${m}/`)));
  if (hits.length < 2) return hits[0];
  const scope = pm === "MD" || pm.startsWith("MD_") ? "MD" : pm === "PM" || pm.startsWith("PM_") ? "PM" : "";
  return hits.find((i) => i.scope === scope) ?? hits[0];
}
