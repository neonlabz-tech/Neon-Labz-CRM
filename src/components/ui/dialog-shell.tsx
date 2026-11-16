"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type ModalContext = {
  /** Ask to close: leaves at once when nothing was typed, asks first when something was. */
  request: () => void;
  /** Closes at once, even with edits (used after a successful save). */
  close: () => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  markForm: () => void;
  /** The bar at the bottom of the window, where a form puts its Cancel and Save buttons. */
  footer: HTMLElement | null;
};

const Ctx = createContext<ModalContext | null>(null);

/** The window around a form, or null when the form is on a page of its own. */
export const useModal = () => useContext(Ctx);

/** Forms inside keep their own Save button right under the form instead of using this window's footer (for a window that holds several forms). */
export function InlineForms({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={null}>{children}</Ctx.Provider>;
}

type Props = {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title?: string;
  subtitle?: string;
  icon: React.ReactNode;
  /** Really closes the window (route change, or dialog.close()). */
  onLeave: () => void;
  /** Clears any form inside when the window closes, so it opens fresh next time. */
  resetOnLeave?: boolean;
  /** Shows a Close button in the footer when no form supplies its own buttons. */
  closeButton?: boolean;
  /** Extra buttons in the footer, before Close. */
  footerExtra?: React.ReactNode;
  /** For a window that only holds a board or a list, whose own windows ask about unsaved edits: closing never asks. */
  noDirtyCheck?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * The shared window: a header, a body that scrolls, and a footer that stays in view.
 * Rules for closing: while saving nothing closes it; with unsaved edits the outside click is ignored
 * (the window shakes) and Esc, X and Cancel ask first; with nothing typed everything closes at once.
 * On a phone it fills the screen.
 */
export function DialogShell({ dialogRef, title, subtitle, icon, onLeave, resetOnLeave, closeButton, footerExtra, noDirtyCheck, className, children }: Props) {
  const [dirty, setDirty] = useState(false);
  const [fallbackDirty, setFallbackDirty] = useState(false);
  const [managed, setManaged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const savingRef = useRef(false);

  const isDirty = managed ? dirty : fallbackDirty;

  const leave = useCallback(() => {
    setAsking(false);
    setDirty(false);
    setFallbackDirty(false);
    if (resetOnLeave) dialogRef.current?.querySelectorAll("form").forEach((form) => form.reset());
    onLeave();
  }, [dialogRef, onLeave, resetOnLeave]);

  const leaveRef = useRef(leave);
  useEffect(() => { leaveRef.current = leave; });
  const close = useCallback(() => leaveRef.current(), []);

  const request = () => {
    if (savingRef.current) return;
    if (isDirty) setAsking(true);
    else leave();
  };

  const onBackdrop = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget || savingRef.current) return;
    if (isDirty) {
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
    } else leave();
  };

  const setSavingBoth = useCallback((value: boolean) => { savingRef.current = value; setSaving(value); }, []);
  const markForm = useCallback(() => setManaged(true), []);
  const context = useMemo<ModalContext>(
    () => ({ request: () => { if (savingRef.current) return; if (isDirty) setAsking(true); else leave(); }, close, setDirty, setSaving: setSavingBoth, markForm, footer }),
    [isDirty, leave, close, setSavingBoth, markForm, footer]
  );

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); request(); }}
      onClick={onBackdrop}
      className={cn(
        "m-auto max-h-[92vh] flex-col overflow-hidden whitespace-normal rounded-2xl border border-line bg-white p-0 text-left text-sm font-normal normal-case shadow-2xl backdrop:bg-ink/50 open:flex",
        "max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
        shaking && "shake",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
          <div className="min-w-0">
            <h2 className="truncate font-bold leading-tight">{title}</h2>
            {subtitle && <p className="truncate text-xs font-semibold text-brand-600">{subtitle}</p>}
          </div>
        </div>
        <button type="button" onClick={request} disabled={saving} aria-label="Close" title="Close" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-brand-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"><X className="h-5 w-5" /></button>
      </div>
      {asking && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-warning/30 bg-warning-soft px-5 py-3 text-sm text-warning">
          <span className="font-medium">Discard unsaved changes?</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAsking(false)}>Keep editing</Button>
            <Button size="sm" variant="danger" onClick={leave}>Discard</Button>
          </span>
        </div>
      )}
      <Ctx.Provider value={context}>
        <div className="modal-body min-h-0 flex-1 overflow-y-auto p-5" onInput={noDirtyCheck ? undefined : () => setFallbackDirty(true)} onChange={noDirtyCheck ? undefined : () => setFallbackDirty(true)}>{children}</div>
        <div ref={setFooter} className="flex shrink-0 justify-end gap-3 border-t border-line bg-white px-5 py-4 empty:hidden max-sm:*:flex-1">
          {footerExtra}
          {closeButton && !managed && <Button variant="outline" onClick={request}>Close</Button>}
        </div>
      </Ctx.Provider>
    </dialog>
  );
}
