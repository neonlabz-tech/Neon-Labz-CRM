"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { markNoticeReadAction, markNoticesReadAction } from "@/server/notice-actions";
import { cn } from "@/lib/utils";

type Item = { id: string; text: string; link: string; read: boolean; when: string };

export function BellMenu({ unread, items }: { unread: number; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  // What was read here since the page loaded, so the badge counts down at once. The server count takes over when it changes.
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setSeen(new Set()); setAll(false); }, [unread]);

  const isRead = (n: Item) => n.read || all || seen.has(n.id);
  const shown = all ? 0 : Math.max(0, unread - items.filter((n) => !n.read && seen.has(n.id)).length);

  /** Opening a notification marks that one as read. Opening the list marks nothing. */
  function readOne(n: Item) {
    if (isRead(n)) return;
    setSeen((prev) => new Set(prev).add(n.id));
    start(() => markNoticeReadAction(n.id));
  }

  function readAll() {
    setAll(true);
    start(() => markNoticesReadAction());
  }

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="brand-gradient relative rounded-full p-2.5 text-white shadow-sm transition-opacity hover:opacity-90" aria-label={`Notifications, ${shown} unread`} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {shown > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-white">{shown > 99 ? "99+" : shown}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {shown > 0 && <button type="button" onClick={readAll} className="text-xs font-semibold text-brand-700 hover:underline">Mark all as read</button>}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nothing new.</li>}
            {items.map((n) => {
              const unreadNow = !isRead(n);
              const body = (<><p className={cn("text-sm", unreadNow && "font-semibold")}>{n.text}</p><p className="mt-0.5 text-xs text-muted">{n.when}</p></>);
              return (
                <li key={n.id} className={cn(unreadNow && "bg-brand-50/60")}>
                  {n.link
                    ? <Link prefetch={false} href={n.link} onClick={() => { readOne(n); setOpen(false); }} className="block px-4 py-3 hover:bg-brand-50">{body}</Link>
                    : <button type="button" onClick={() => readOne(n)} className="block w-full px-4 py-3 text-left hover:bg-brand-50">{body}</button>}
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
