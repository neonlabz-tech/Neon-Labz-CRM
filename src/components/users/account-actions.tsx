"use client";

import { useRef, useState, useTransition } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { deleteUserAction, revealPasswordAction, saveAccountAction, verifyAdminPasswordAction } from "@/server/user-actions";
import { PasswordInput } from "@/components/auth/password-field";

const box = "m-auto h-fit max-h-none overflow-hidden whitespace-normal bg-white text-left text-sm font-normal normal-case w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line p-6 shadow-2xl backdrop:bg-ink/40";
const input = "mt-1.5 h-11 w-full rounded-xl border border-line px-3.5 text-sm";

/** The eye shows a login's password and the pencil edits it. Both ask for the Super Admin's own password first. */
export function AccountActions({ username, active, self }: { username: string; active: boolean; self: boolean }) {
  const viewRef = useRef<HTMLDialogElement>(null);
  const editRef = useRef<HTMLDialogElement>(null);
  const [mine, setMine] = useState("");
  const [shown, setShown] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [next, setNext] = useState({ active, password: "", confirm: "" });
  const [pending, start] = useTransition();
  const toast = useToast();

  function reset() {
    setMine(""); setShown(""); setVerified(false); setError(""); setNext({ active, password: "", confirm: "" });
  }
  const [shaking, setShaking] = useState(false);
  const dirty = Boolean(mine || next.password || next.confirm || next.active !== active);
  /** Esc and the outside click close the window only when nothing was typed and nothing is saving. */
  const guard = (ref: React.RefObject<HTMLDialogElement | null>) => ({
    onCancel: (event: React.SyntheticEvent) => { event.preventDefault(); attempt(ref); },
    onClick: (event: React.MouseEvent<HTMLDialogElement>) => { if (event.target === event.currentTarget) attempt(ref); },
  });
  function attempt(ref: React.RefObject<HTMLDialogElement | null>) {
    if (pending) return;
    if (dirty) { setShaking(true); setTimeout(() => setShaking(false), 450); return; }
    close(ref);
  }
  function close(ref: React.RefObject<HTMLDialogElement | null>) {
    ref.current?.close();
    reset();
  }

  return (
    <div className="flex gap-1">
      <Button size="iconSm" variant="outline" aria-label={`View password for ${username}`} title="View password" onClick={() => { reset(); viewRef.current?.showModal(); }}><Eye className="h-4 w-4" /></Button>
      {!self && <Button size="iconSm" variant="outline" aria-label={`Edit ${username}`} title="Edit login" onClick={() => { reset(); editRef.current?.showModal(); }}><Pencil className="h-4 w-4" /></Button>}

      <dialog ref={viewRef} className={`${box} ${shaking ? "shake" : ""}`} onClose={reset} {...guard(viewRef)}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              const result = await revealPasswordAction(username, mine);
              if (result.ok && result.password) { setShown(result.password); setMine(""); setError(""); } else setError(result.message);
            });
          }}
        >
          <h2 className="text-lg font-bold">View password</h2>
          <p className="mt-2 text-sm text-muted">
            {shown ? `Password for ${username}. This does not change it.` : `Enter your password before viewing the login for ${username}. This does not change the password.`}
          </p>
          {shown ? (
            <label className="mt-4 block text-sm font-medium">Password<input readOnly value={shown} onFocus={(event) => event.target.select()} className={input} /></label>
          ) : (
            <label className="mt-4 block text-sm font-medium">Your password<input type="password" value={mine} onChange={(event) => setMine(event.target.value)} autoComplete="current-password" required className={input} /></label>
          )}
          {error && <p className="mt-3 text-sm font-medium text-danger" role="alert">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            {!shown && <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Verify"}</Button>}
            <Button type="button" variant="outline" onClick={() => close(viewRef)}>Close</Button>
          </div>
        </form>
      </dialog>

      <dialog ref={editRef} className={`${box} ${shaking ? "shake" : ""}`} onClose={reset} {...guard(editRef)}>
        {!verified ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              start(async () => {
                const result = await verifyAdminPasswordAction(mine);
                if (result.ok) { setVerified(true); setError(""); } else setError(result.message);
              });
            }}
          >
            <h2 className="text-lg font-bold">Confirm your password</h2>
            <p className="mt-2 text-sm text-muted">Enter your password to edit the login for {username}.</p>
            <label className="mt-4 block text-sm font-medium">Your password<input type="password" value={mine} onChange={(event) => setMine(event.target.value)} autoComplete="current-password" required className={input} /></label>
            {error && <p className="mt-3 text-sm font-medium text-danger" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="submit" disabled={pending}>Verify</Button>
              <Button type="button" variant="outline" onClick={() => close(editRef)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              start(async () => {
                const result = await saveAccountAction(username, mine, next);
                if (result.ok) { toast(true, result.message); close(editRef); } else setError(result.message);
              });
            }}
          >
            <h2 className="text-lg font-bold">Edit {username}</h2>
            <p className="mt-2 text-sm text-muted">Set a temporary password of at least 8 characters and share it privately. They must change it the next time they sign in.</p>
            <label className="mt-4 block text-sm font-medium">Status
              <select value={next.active ? "active" : "inactive"} onChange={(event) => setNext({ ...next, active: event.target.value === "active" })} className={input}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium">New password<input type="password" value={next.password} onChange={(event) => setNext({ ...next, password: event.target.value })} autoComplete="new-password" className={input} /></label>
            <label className="mt-3 block text-sm font-medium">Confirm new password<input type="password" value={next.confirm} onChange={(event) => setNext({ ...next, confirm: event.target.value })} autoComplete="new-password" className={input} /></label>
            {error && <p className="mt-3 text-sm font-medium text-danger" role="alert">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title={`Delete ${username}?`} text="This removes the login. It cannot be undone." confirmLabel="Delete" run={() => deleteUserAction(username)} />
              <div className="flex gap-2">
                <Button type="submit" disabled={pending}>Save changes</Button>
                <Button type="button" variant="outline" onClick={() => close(editRef)}>Cancel</Button>
              </div>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
