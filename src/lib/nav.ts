import { can, type Action, type Role } from "./permissions";

export type IconName = "search" | "dashboard" | "users" | "audit" | "account" | "leads" | "quotes" | "payments" | "approvals" | "clients" | "packages" | "projects" | "work" | "info" | "plans" | "hrms" | "finance" | "issues" | "productivity" | "activity" | "reports" | "mreports";
type Tab = { href: string; label: string; action?: Action };
/** One sidebar entry. Its tabs are shown at the top of every page inside it. */
type Area = { title: string; icon: IconName; action?: Action; own?: boolean; tabs: Tab[] };
type AreaGroup = { title: string; areas: Area[] };

export type NavItem = { href: string; label: string; icon: IconName; own: boolean; match: string[]; tabs: { href: string; label: string }[] };
export type NavGroup = { title: string; items: NavItem[] };

const GROUPS: AreaGroup[] = [
  { title: "Main", areas: [{ title: "Dashboard", icon: "dashboard", tabs: [{ href: "/dashboard", label: "Dashboard" }] }] },
  {
    title: "Work",
    areas: [
      {
        title: "Sales", icon: "leads",
        tabs: [
          { href: "/sales-overview", label: "Overview", action: "sales.targets" },
          { href: "/leads", label: "Leads", action: "leads.manage" },
          { href: "/quotations", label: "Quotations", action: "quotations.manage" },
          { href: "/payments", label: "Payments", action: "payments.submit" },
          { href: "/approvals", label: "Approvals", action: "payments.approve" },
          { href: "/sales-reports", label: "Reports", action: "sales.targets" },
          { href: "/sales-team", label: "Team", action: "sales.targets" },
          { href: "/sales-settings", label: "Settings", action: "sales.targets" },
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
        title: "Projects", icon: "projects",
        tabs: [
          { href: "/projects", label: "Projects", action: "projects.view" },
          { href: "/sprints", label: "Sprints", action: "projects.view" },
          { href: "/milestones", label: "Milestones", action: "projects.view" },
          { href: "/issues", label: "Issues", action: "issues.manage" },
          { href: "/reports", label: "Reports", action: "reports.manage" },
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
        title: "Marketing", icon: "info",
        tabs: [
          { href: "/marketing/info", label: "Client info", action: "marketing.view" },
          { href: "/marketing/plans", label: "Content plans", action: "marketing.view" },
          { href: "/marketing/reports", label: "Reports", action: "marketing.view" },
          { href: "/marketing/progress", label: "Progress", action: "marketing.monitor" },
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
      { title: "Activity log", icon: "audit", tabs: [{ href: "/audit", label: "Activity log", action: "audit.view" }] },
    ],
  },
  { title: "Account", areas: [{ title: "My account", icon: "account", tabs: [{ href: "/account", label: "My account" }] }] },
];

export function navFor(role: Role): NavGroup[] {
  return GROUPS.map((group) => ({
    title: group.title,
    items: group.areas.flatMap((area): NavItem[] => {
      const tabs = area.tabs.filter((tab) => !tab.action || can(role, tab.action)).map(({ href, label }) => ({ href, label }));
      const first = tabs[0];
      if (!first || (area.action && !can(role, area.action))) return [];
      const own = Boolean(area.own);
      return [{ href: `${first.href}${own ? "?own=1" : ""}`, label: area.title, icon: area.icon, own, match: tabs.map((t) => t.href), tabs: tabs.length > 1 ? tabs : [] }];
    }),
  })).filter((group) => group.items.length > 0);
}
