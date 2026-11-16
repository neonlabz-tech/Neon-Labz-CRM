import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/packages", label: "Packages" },
  { href: "/packages/quotations", label: "Quotations" },
] as const;

/** Packages / Quotations switch on the Super Admin's Packages page. */
export function PackageTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Packages sections">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.href === active ? "page" : undefined}
          className={cn("rounded-full px-5 py-2 text-sm font-semibold", tab.href === active ? "brand-gradient text-white shadow" : "border border-line bg-white text-ink hover:bg-brand-50")}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
