"use client";

import { Eye } from "lucide-react";
import { useRef } from "react";
import { Button } from "./button";
import { DialogShell } from "./dialog-shell";

type Props = {
  label: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** The icon in the window header; the eye by default. */
  headerIcon?: React.ReactNode;
  /** Text on the button when no icon is given. */
  text?: string;
  variant?: "primary" | "outline" | "secondary";
  /** Shows this as a plain link-style trigger (for example a project name) instead of a button. */
  trigger?: React.ReactNode;
  /** A wide window, for a board or a table. */
  wide?: boolean;
  children: React.ReactNode;
};

/**
 * A button that opens a window over the page; the content is passed in as children.
 * A window that only shows details closes on Esc, X, Close or an outside click; one with a form follows the DialogShell rules.
 */
export function DialogButton({ label, title, subtitle, icon, headerIcon, text, variant = "outline", trigger, wide, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      {trigger ? (
        <button type="button" title={label} aria-label={label} onClick={() => ref.current?.showModal()} className="text-left font-semibold text-brand-700 hover:underline">{trigger}</button>
      ) : (
        <Button size={icon ? "iconSm" : "sm"} variant={variant} title={label} aria-label={label} onClick={() => ref.current?.showModal()}>
          {icon ?? text ?? label}
        </Button>
      )}
      <DialogShell dialogRef={ref} title={title} subtitle={subtitle} icon={headerIcon ?? <Eye className="h-5 w-5" />} onLeave={() => ref.current?.close()} resetOnLeave closeButton noDirtyCheck={wide} className={wide ? "h-fit w-[min(72rem,calc(100vw-1rem))]" : "h-fit w-[min(40rem,calc(100vw-1rem))]"}>
        {children}
      </DialogShell>
    </>
  );
}
