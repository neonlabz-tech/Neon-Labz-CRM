"use client";

import { FileText, Pencil, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DialogShell } from "./dialog-shell";

export { useModal } from "./dialog-shell";

function iconFor(title: string) {
  if (/^(add|new|create|record|schedule)/i.test(title)) return <Plus className="h-5 w-5" />;
  if (/^(edit|review)/i.test(title)) return <Pencil className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

/**
 * A form in a window over the page. Without `closeHref` the window goes back when it closes.
 * It also goes away by itself when the page address changes, for example after a save redirects. See DialogShell for the closing rules.
 */
export function Modal({ title, subtitle, closeHref, children }: { title?: string; subtitle?: string; closeHref?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  // A window opened by a link stays in its slot after a save redirects away. Once the address is no longer the one it opened on, it removes itself.
  const [openedOn] = useState(pathname);

  useEffect(() => {
    const dialog = ref.current;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => before?.focus();
  }, []);

  if (pathname !== openedOn) return null;

  return (
    <DialogShell
      dialogRef={ref}
      title={title}
      subtitle={subtitle}
      icon={iconFor(title ?? "")}
      onLeave={() => (closeHref ? router.push(closeHref) : router.back())}
      className="w-[min(62rem,calc(100vw-1rem))]"
    >
      {children}
    </DialogShell>
  );
}
