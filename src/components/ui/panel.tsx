import Link from "next/link";
import { Modal } from "./modal";

/** A form shown in a window over the list while adding or editing; the close button returns to `closeHref`. */
export function Panel({ title, subtitle, closeHref, children }: { title: string; subtitle?: string; closeHref: string; children: React.ReactNode }) {
  return <Modal title={title} subtitle={subtitle} closeHref={closeHref}>{children}</Modal>;
}

export function AddLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white">{children}</Link>;
}
