"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { markNoticeReadAction } from "@/server/notice-actions";
import { cn } from "@/lib/utils";

/** One row of the Notifications page. Opening it (or clicking it when it has no page) marks just that notification as read. */
export function NoticeRow({ id, text, when, link, read }: { id: string; text: string; when: string; link: string; read: boolean }) {
  const [done, setDone] = useState(read);
  const [, start] = useTransition();
  function mark() {
    if (done) return;
    setDone(true);
    start(() => markNoticeReadAction(id));
  }
  const body = (
    <span className="flex items-start gap-3">
      <BellRing className={cn("mt-0.5 h-4 w-4 shrink-0", done ? "text-muted" : "text-brand-600")} />
      <span><span className={cn("block text-sm", !done && "font-semibold")}>{text}</span><span className="mt-0.5 block text-xs text-muted">{when}</span></span>
    </span>
  );
  const cls = cn("block px-4 py-3 hover:bg-brand-50", !done && "bg-brand-50/60");
  return link
    ? <Link prefetch={false} href={link} onClick={mark} className={cls}>{body}</Link>
    : <button type="button" onClick={mark} className={cn(cls, "w-full text-left")}>{body}</button>;
}

/** A link in the dashboard's "New for you" card that marks its notification as read when opened. */
export function NoticeLink({ id, link, children }: { id: string; link: string; children: React.ReactNode }) {
  const [, start] = useTransition();
  return <Link prefetch={false} href={link} onClick={() => start(() => markNoticeReadAction(id))} className="font-medium text-brand-700 hover:underline">{children}</Link>;
}
