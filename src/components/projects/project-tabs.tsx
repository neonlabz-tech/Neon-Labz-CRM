import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/projects", label: "Projects" },
  { href: "/sprints", label: "Sprints" },
  { href: "/milestones", label: "Milestones" },
  { href: "/reports", label: "Reports" },
] as const;

/** Projects / Sprints / Milestones / Reports switch. The Reports tab shows only where the person may manage reports. */
export function ProjectTabs({ active, own = false, pm = "", reports = false }: { active: (typeof TABS)[number]["href"]; own?: boolean; pm?: string; reports?: boolean }) {
  const query = new URLSearchParams({ ...(own ? { own: "1" } : {}), ...(pm ? { pm } : {}) }).toString();
  return (
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Project sections">
      {TABS.filter((tab) => reports || tab.href !== "/reports").map((tab) => (
        <Link key={tab.href} href={query ? `${tab.href}?${query}` : tab.href} aria-current={tab.href === active ? "page" : undefined}
          className={cn("rounded-full px-5 py-2 text-sm font-semibold", tab.href === active ? "brand-gradient text-white shadow" : "border border-line bg-white text-ink hover:bg-brand-50")}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
