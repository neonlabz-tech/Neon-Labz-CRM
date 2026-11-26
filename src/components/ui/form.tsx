"use client";

import { createContext, Fragment, useActionState, useContext, useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "./button";
import { useModal } from "./dialog-shell";
import { useToast } from "./toast";
import { controlsOf, formatPhoneField, isControl, isPhoneField, labelOf, validateControl } from "@/lib/form-rules";
import { idle, type ActionState } from "@/types";

type Errors = Record<string, string>;
type Shown = Record<string, { message: string; label: string; loose: boolean }>;

const ErrorsContext = createContext<Errors>({});

export const useFieldError = (name: string | undefined) => useContext(ErrorsContext)[name ?? ""];

type Props = {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  submit: string;
  children: React.ReactNode;
  toastOnSuccess?: boolean;
  resetOnSuccess?: boolean;
  className?: string;
};

const serialize = (form: HTMLFormElement) =>
  JSON.stringify(Array.from(new FormData(form).entries()).map(([key, value]) => [key, typeof value === "string" ? value : `${value.name}:${value.size}`]));

/**
 * Every add/edit form. A field is checked when the person leaves it, and again on every change after that;
 * the message appears right under it. Submitting with problems shows them all, focuses the first and keeps what was typed.
 * The server checks everything again and its messages land under the same fields.
 * Nothing resets the form except a successful save (when asked to) or closing the window.
 * A successful save inside a window closes the window.
 */
export function ActionForm({ action, submit, children, toastOnSuccess = true, resetOnSuccess = false, className }: Props) {
  const [state, formAction, pending] = useActionState(action, idle);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const modal = useModal();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const touched = useRef(new Set<string>());
  const snapshot = useRef("");
  const submitting = useRef(false);
  const [shown, setShown] = useState<Shown>({});
  // Bumped after a saved "add" form: every field (including the rich-text Details box) starts again from empty.
  const [round, setRound] = useState(0);
  const [dismissed, setDismissed] = useState<{ state: ActionState; names: string[] }>({ state: idle, names: [] });

  const setDirty = modal?.setDirty;
  const setSaving = modal?.setSaving;
  const markForm = modal?.markForm;
  const closeModal = modal?.close;

  // The form's starting values, to tell later whether anything really changed.
  useEffect(() => {
    if (formRef.current) snapshot.current = serialize(formRef.current);
    markForm?.();
  }, [markForm]);

  useEffect(() => { setSaving?.(pending); }, [pending, setSaving]);

  useEffect(() => {
    if (state === idle) return;
    submitting.current = false;
    const form = formRef.current;
    if (!form) return;
    if (state.ok) {
      if (resetOnSuccess) { form.reset(); touched.current.clear(); setShown({}); setRound((n) => n + 1); }
      snapshot.current = serialize(form);
      setDirty?.(false);
      closeModal?.();
    } else if (state.errors) {
      const first = controlsOf(form).find((el) => state.errors?.[el.name]);
      first?.focus();
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state, resetOnSuccess, setDirty, closeModal]);

  useEffect(() => {
    if (state.message && toastOnSuccess && state.ok) toast(true, state.message);
    if (state.message && !state.ok && !state.errors) toast(false, state.message);
  }, [state, toast, toastOnSuccess]);

  function check(form: HTMLFormElement): Shown {
    const next: Shown = {};
    for (const el of controlsOf(form)) {
      if (!touched.current.has(el.name)) continue;
      const message = validateControl(el, form);
      if (message) next[el.name] = { message, label: labelOf(el), loose: !el.hasAttribute("data-field") };
    }
    return next;
  }

  function onBlur(event: React.FocusEvent<HTMLFormElement>) {
    const el = event.target;
    if (!isControl(el) || !el.name) return;
    touched.current.add(el.name);
    setShown(check(event.currentTarget));
  }

  function onChange(event: React.ChangeEvent<HTMLFormElement>) {
    const el = event.target;
    if (!isControl(el) || !el.name) return;
    if (isPhoneField(el)) formatPhoneField(el);
    setDismissed((current) => ({ state, names: [...(current.state === state ? current.names : []), el.name] }));
    setShown(check(event.currentTarget));
    setDirty?.(serialize(event.currentTarget) !== snapshot.current);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (pending || submitting.current) return;
    const controls = controlsOf(form);
    controls.forEach((el) => touched.current.add(el.name));
    const problems = check(form);
    setShown(problems);
    const first = controls.find((el) => problems[el.name]);
    if (first) {
      first.focus();
      first.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    submitting.current = true;
    const data = new FormData(form, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => formAction(data));
  }

  const serverErrors = dismissed.state === state ? Object.fromEntries(Object.entries(state.errors ?? {}).filter(([name]) => !dismissed.names.includes(name))) : (state.errors ?? {});
  const errors: Errors = { ...serverErrors, ...Object.fromEntries(Object.entries(shown).map(([name, item]) => [name, item.message])) };
  const loose = Object.values(shown).filter((item) => item.loose);

  const buttons = (
    <>
      {modal && <Button variant="outline" onClick={modal.request} disabled={pending}>Cancel</Button>}
      <Button type="submit" form={formId} disabled={pending} aria-busy={pending} className={modal ? "" : "w-full sm:w-auto"}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {submit}
      </Button>
    </>
  );

  return (
    <form id={formId} method="post" ref={formRef} noValidate onSubmit={onSubmit} onBlur={onBlur} onChange={onChange} className={className ?? "space-y-4"}>
      <ErrorsContext.Provider value={errors}><Fragment key={round}>{children}</Fragment></ErrorsContext.Provider>
      {loose.length > 0 && (
        <ul className="col-span-full space-y-0.5 text-sm font-medium text-danger" role="alert">
          {loose.map((item) => <li key={item.label}>{item.label}: {item.message}</li>)}
        </ul>
      )}
      {state.message && !state.ok && state.errors && Object.keys(serverErrors).length > 0 && <p className="col-span-full text-sm font-medium text-danger" role="alert">{state.message}</p>}
      {state.message && state.ok && !toastOnSuccess && <p className="col-span-full text-sm font-medium text-success" role="status">{state.message}</p>}
      {modal ? (modal.footer ? createPortal(buttons, modal.footer) : null) : <div className="col-span-full flex items-center gap-3">{buttons}</div>}
    </form>
  );
}
