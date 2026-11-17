"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { markNoticesReadAction } from "@/server/notice-actions";
import { cn } from "@/lib/utils";

type Item = { id: string; text: string; link: string; read: boolean; when: string };

export function BellMenu({ unread, items }: { unread: number; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const [hidden, setHidden] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setHidden(false); }, [unread]);

  /** Opening the list counts as seeing everything: the badge clears and the new ones stay highlighted until it closes. */
  function toggle() {
    if (!open && unread > 0) {
      setFresh(new Set(items.filter((n) => !n.read).map((n) => n.id)));
      setHidden(true);
      start(() => markNoticesReadAction());
    }
    if (open) setFresh(new Set());
    setOpen((v) => !v);
  }

  const shown = hidden ? 0 : unread;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} className="brand-gradient relative rounded-full p-2.5 text-white shadow-sm transition-opacity hover:opacity-90" aria-label={`Notifications, ${shown} unread`} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {shown > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-white">{shown > 99 ? "99+" : shown}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notifications</p>
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nothing new.</li>}
            {items.map((n) => {
              const body = (<><p className={cn("text-sm", fresh.has(n.id) && "font-medium")}>{n.text}</p><p className="mt-0.5 text-xs text-muted">{n.when}</p></>);
              return (
                <li key={n.id} className={cn("px-4 py-3", fresh.has(n.id) && "bg-brand-50/60")}>
                  {n.link ? <Link prefetch={false} href={n.link} onClick={() => setOpen(false)} className="block hover:underline">{body}</Link> : body}
                </li>
              );
            })}
          </ul>
          <Link prefetch={false} href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-brand-50">View all notifications</Link>
        </div>
      )}
    </div>
  );
}
