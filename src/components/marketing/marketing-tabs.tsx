import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/marketing/info", label: "Info Doc" },
  { href: "/marketing/plans", label: "Content Plan" },
  { href: "/marketing/reports", label: "Reports" },
] as const;

/** Info Doc / Content Plan / Reports switch for the Super Admin, in the own view or when looking at one marketing admin. */
export function MarketingTabs({ active, own = false, md = "" }: { active: (typeof TABS)[number]["href"]; own?: boolean; md?: string }) {
  const query = new URLSearchParams({ ...(own ? { own: "1" } : {}), ...(md ? { md } : {}) }).toString();
  return (
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Marketing sections">
      {TABS.map((tab) => (
        <Link key={tab.href} href={query ? `${tab.href}?${query}` : tab.href} aria-current={tab.href === active ? "page" : undefined}
          className={cn("rounded-full px-5 py-2 text-sm font-semibold", tab.href === active ? "brand-gradient text-white shadow" : "border border-line bg-white text-ink hover:bg-brand-50")}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
