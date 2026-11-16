"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof Field>, "type"> & { dark?: boolean };

function Toggle({ shown, onToggle, dark, className }: { shown: boolean; onToggle: () => void; dark?: boolean; className: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      title={shown ? "Hide password" : "Show password"}
      className={cn("absolute right-1 flex h-11 w-10 cursor-pointer items-center justify-center rounded-lg", dark ? "text-white/60 hover:text-white" : "text-muted hover:text-ink", className)}
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

/** A labelled password field with a show/hide button. `dark` is for the sign-in page. */
export function PasswordField({ dark, ...props }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Field {...props} type={shown ? "text" : "password"} className="pr-11" />
      <Toggle shown={shown} onToggle={() => setShown((v) => !v)} dark={dark} className="top-[26px]" />
    </div>
  );
}

/** A bare password input with a show/hide button, for forms that write their own label. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative mt-1 block">
      <input {...props} type={shown ? "text" : "password"} className={cn(className, "mt-0 pr-11")} />
      <Toggle shown={shown} onToggle={() => setShown((v) => !v)} className="top-0" />
    </span>
  );
}
