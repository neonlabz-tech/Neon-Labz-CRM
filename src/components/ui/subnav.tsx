"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** `prefix` keeps a tab lit on its sub-pages (e.g. a project's detail page). */
export function SubNav({ tabs, prefix = false }: { tabs: { href: string; label: string }[]; prefix?: boolean }) {
  const path = usePathname();
  const params = useSearchParams();
  const keep = new URLSearchParams([...params].filter(([key]) => key === "own" || key === "pm" || key === "md")).toString();
  // When one tab's address starts another's (/my-targets and /my-targets/history), only the longest match is lit.
  const hits = tabs.filter((tab) => path === tab.href || (prefix && path.startsWith(`${tab.href}/`)));
  const best = hits.reduce<string>((longest, tab) => (tab.href.length > longest.length ? tab.href : longest), "");
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-brand-50 p-1" aria-label="Sections">
      {tabs.map((tab) => {
        const active = tab.href === best;
        return (
          <Link prefetch={false} key={tab.href} href={keep ? `${tab.href}?${keep}` : tab.href} aria-current={active ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold", active ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink")}>{tab.label}</Link>
        );
      })}
    </nav>
  );
}
