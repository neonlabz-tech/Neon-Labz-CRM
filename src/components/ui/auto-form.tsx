"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A filter bar with no Search button: typing in the search box applies after a short pause,
 * and changing a dropdown or date applies at once. The page number always starts again at 1.
 */
export function AutoForm({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply() {
    clearTimeout(timer.current);
    if (!form.current) return;
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(form.current)) {
      if (typeof value === "string" && value.trim() !== "") params.set(name, value.trim());
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <form
      ref={form}
      role="search"
      className={cn(className, pending && "opacity-80 transition-opacity")}
      aria-busy={pending}
      onSubmit={(event) => { event.preventDefault(); apply(); }}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "search" || target.type === "")) {
          clearTimeout(timer.current);
          timer.current = setTimeout(apply, 350);
        } else {
          apply();
        }
      }}
    >
      {children}
    </form>
  );
}

/** Puts every box back to its default, then opens the given address. */
export function ClearFilters({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.currentTarget.closest("form")?.reset();
        router.replace(href, { scroll: false });
      }}
    >
      {children}
    </button>
  );
}
