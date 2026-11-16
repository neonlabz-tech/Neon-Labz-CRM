"use client";

import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Grows with its content, but in the "All" view of a list it becomes a box of fixed height that scrolls. */
export function ScrollBox({ className, children }: { className?: string; children: React.ReactNode }) {
  const all = useSearchParams().get("page") === "all";
  return <div className={cn(className, all && "max-h-[68vh] overflow-y-auto overscroll-contain")}>{children}</div>;
}
