"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SubNav } from "@/components/ui/subnav";
import type { NavGroup } from "@/lib/nav";

/** Tabs of the sidebar area the person is in, shown above every page of that area. */
export function AreaTabs({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const own = useSearchParams().get("own") === "1";
  const item = groups.flatMap((g) => g.items).find((i) => i.own === own && i.match.some((m) => path === m || path.startsWith(`${m}/`)));
  if (!item || item.tabs.length === 0) return null;
  return <SubNav tabs={item.tabs} prefix />;
}
