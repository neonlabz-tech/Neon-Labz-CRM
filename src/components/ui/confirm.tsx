"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useRef, useTransition } from "react";
import { Button } from "./button";
import { useToast } from "./toast";
import type { ActionState } from "@/types";

type Props = {
  label: string;
  title: string;
  text: string;
  confirmLabel: string;
  run: () => Promise<ActionState>;
  variant?: "danger" | "primary" | "outline";
  icon?: React.ReactNode;
};

export function ConfirmButton({ label, title, text, confirmLabel, run, variant = "danger", icon }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <>
      <Button size={icon ? "iconSm" : "sm"} variant={variant === "danger" ? "outline" : variant} title={label} aria-label={label} onClick={() => ref.current?.showModal()} className={variant === "danger" ? "text-danger" : ""}>
        {icon}{!icon && label}
      </Button>
      <dialog ref={ref} onClick={(event) => { if (event.target === event.currentTarget && !pending) ref.current?.close(); }} className="m-auto h-fit max-h-none w-[min(28rem,calc(100vw-2rem))] overflow-hidden whitespace-normal rounded-2xl border border-line bg-white p-0 text-left text-sm font-normal normal-case shadow-2xl backdrop:bg-ink/40">
        <div className="flex gap-4 p-6">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${variant === "danger" ? "bg-danger-soft text-danger" : "bg-brand-50 text-brand-600"}`}>
            {variant === "danger" ? <TriangleAlert className="h-5 w-5" /> : <CircleCheck className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="text-lg font-bold leading-tight">{title}</h2>
            <p className="mt-1.5 text-sm text-muted">{text}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button variant="outline" onClick={() => ref.current?.close()}>Cancel</Button>
          <Button
            variant={variant === "outline" ? "primary" : variant}
            disabled={pending}
            onClick={() => start(async () => {
              const result = await run();
              toast(result.ok, result.message);
              ref.current?.close();
            })}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
