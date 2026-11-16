"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A table row or card that opens `href` when it is clicked anywhere.
 * Clicks on a button, link, checkbox, field or window inside it, and text selections, are left alone.
 */
export function RowLink({ as, href, className, children }: { as: "tr" | "li"; href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const open = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label, dialog, summary, [data-no-row]")) return;
    if (window.getSelection()?.toString()) return;
    router.push(href);
  };
  const classes = cn(className, "cursor-pointer");
  return as === "tr" ? <tr className={classes} onClick={open}>{children}</tr> : <li className={classes} onClick={open}>{children}</li>;
}
