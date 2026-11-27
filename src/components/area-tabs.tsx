"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SubNav } from "@/components/ui/subnav";
import { activeItem, type NavGroup } from "@/lib/nav";

/** Tabs of the sidebar area the person is in, shown above every page of that area. */
export function AreaTabs({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const params = useSearchParams();
  const item = activeItem(groups, path, params.get("own") === "1", params.get("pm") ?? "", params.get("work") === "1");
  if (!item || item.tabs.length === 0) return null;
  return <SubNav tabs={item.tabs} scope={item.scope} prefix />;
}
