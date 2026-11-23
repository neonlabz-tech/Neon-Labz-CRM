"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type SubTab = { href: string; label: string; scoped?: boolean };

/**
 * `prefix` keeps a tab lit on its sub-pages (e.g. a project's detail page).
 * In the Super Admin's PM / MD area, `scoped` tabs carry the team (pm=PM or pm=MD) so the page shows only that team's work;
 * a chosen account of the same team is kept when moving between tabs.
 */
export function SubNav({ tabs, prefix = false, scope = "" }: { tabs: SubTab[]; prefix?: boolean; scope?: "PM" | "MD" | "" }) {
  const path = usePathname();
  const params = useSearchParams();
  const keep = [...params].filter(([key]) => key === "own" || key === "pm" || key === "md");
  // When one tab's address starts another's (/my-targets and /my-targets/history), only the longest match is lit.
  const hits = tabs.filter((tab) => path === tab.href || (prefix && path.startsWith(`${tab.href}/`)));
  const best = hits.reduce<string>((longest, tab) => (tab.href.length > longest.length ? tab.href : longest), "");
  const current = params.get("pm") ?? "";
  const linkFor = (tab: SubTab) => {
    const query = new URLSearchParams(keep);
    if (scope && tab.scoped) query.set("pm", current === scope || current.startsWith(`${scope}_`) ? current : scope);
    const text = query.toString();
    return text ? `${tab.href}?${text}` : tab.href;
  };
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-brand-50 p-1" aria-label="Sections">
      {tabs.map((tab) => {
        const active = tab.href === best;
        return (
          <Link prefetch={false} key={tab.href} href={linkFor(tab)} aria-current={active ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold", active ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink")}>{tab.label}</Link>
        );
      })}
    </nav>
  );
}
