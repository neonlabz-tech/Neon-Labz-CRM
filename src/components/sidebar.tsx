"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Bell, Briefcase, CalendarRange, ClipboardList, Activity, Bug, ChartColumn, Gauge, HandCoins, UsersRound, FolderKanban, ListChecks, ChevronsLeft, FileText, LayoutDashboard, LogOut, Menu, Package, PhoneCall, Search, ShieldCheck, UserCog, UserRound, Wallet, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { logoutAction } from "@/server/auth-actions";
import type { IconName, NavGroup } from "@/lib/nav";

const ICONS = {
  dashboard: LayoutDashboard, users: UserCog, audit: ShieldCheck, account: UserRound, leads: PhoneCall, quotes: FileText,
  search: Search, payments: Wallet, approvals: BadgeCheck, clients: Briefcase, packages: Package, projects: FolderKanban, work: ListChecks, info: ClipboardList, hrms: UsersRound, issues: Bug, reports: FileText, mreports: ChartColumn, productivity: Gauge, activity: Activity, finance: HandCoins, plans: CalendarRange, notifications: Bell,
} satisfies Record<IconName, typeof LayoutDashboard>;

type Props = { groups: NavGroup[]; name: string; roleLabel: string; collapsedByDefault: boolean; bell: React.ReactNode };

export function Sidebar({ groups, name, roleLabel, collapsedByDefault, bell }: Props) {
  const background = "bg-gradient-to-b from-[#1c2142] via-[#4b1fa8] to-[#1c2142]";
  const pathname = usePathname();
  const own = useSearchParams().get("own") === "1";
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const [open, setOpen] = useState(false);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `nl_sidebar=${next ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  }

  const panel = (compact: boolean) => (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className={cn("flex items-center", compact ? "justify-center" : "justify-between px-2 pb-3 pt-1")}>
        {compact ? (
          <Image src="/mark-white.png" alt="NeonLabz" width={24} height={24} priority className="h-6 w-6" />
        ) : (
          <Image src="/logo-white.png" alt="NeonLabz" width={222} height={24} priority className="h-5 w-auto min-w-0 max-w-[calc(100%-2.5rem)] object-contain object-left lg:max-w-full" />
        )}
        <button onClick={() => setOpen(false)} className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden" aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>

      <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto pr-1" aria-label="Main">
        {groups.map((group) => (
          <div key={group.title}>
            {!compact && group.title !== "Main" && <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-white/50">{group.title}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                
                const active = item.own === own && item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
                return (
                  <li key={item.href}>
                    <Link
                      prefetch={false}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      title={compact ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border-b border-white/5 px-3 py-2.5 text-[14px] font-medium transition-colors",
                        compact && "justify-center",
                        active ? "bg-white/20 text-white shadow-inner" : "text-white/75 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!compact && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("flex items-center gap-3 rounded-2xl bg-white/10 p-2.5", compact && "flex-col")}>
        <span className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">{initials(name)}</span>
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-white">{name}</p>
            <p className="truncate text-[13px] text-white/60">{roleLabel}</p>
          </div>
        )}
        <form action={logoutAction}>
          <button className="rounded-lg p-2 text-white/70 hover:bg-white/15 hover:text-white" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-brand-50" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <Image src="/logo.png" alt="NeonLabz" width={120} height={30} className="h-7 w-auto" />
        {bell}
      </header>

      {open && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-60 shadow-xl transition-transform lg:hidden", background, open ? "translate-x-0" : "-translate-x-full")}>
        {panel(false)}
      </aside>

      <aside className={cn("relative hidden shrink-0 transition-[width] duration-200 lg:block", collapsed ? "w-[72px]" : "w-60")}>
        {/* The colour sits on the screen-high sticky box, so it stays the same however long the page is. */}
        <div className={cn("sticky top-0 h-screen", background)}>{panel(collapsed)}</div>
        <button
          onClick={toggle}
          className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-muted shadow hover:text-brand-700"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft className={cn("h-3.5 w-3.5 transition-transform", collapsed && "rotate-180")} />
        </button>
      </aside>
    </>
  );
}
