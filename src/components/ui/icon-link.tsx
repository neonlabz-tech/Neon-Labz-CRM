import Link from "next/link";
import { cn } from "@/lib/utils";

/** Square icon button used for the actions in a table row. The label shows as a tooltip and is read by screen readers. */
export const iconButton = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink transition-colors hover:bg-brand-50 [&_svg]:h-4 [&_svg]:w-4";

export function IconLink({ href, label, children, className }: { href: string; label: string; children: React.ReactNode; className?: string }) {
  return <Link prefetch={false} href={href} title={label} aria-label={label} className={cn(iconButton, className)}>{children}</Link>;
}
