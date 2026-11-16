"use client";

import { useFieldError } from "./form";
import { cn } from "@/lib/utils";

/** Red star after the label of a required field. */
function Label({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
      {children}
      {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
    </label>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

export function Field({ label, id, className, ...props }: FieldProps) {
  const fieldId = id ?? props.name;
  const error = useFieldError(props.name);
  const phone = /phone/i.test(props.name ?? "") && !props.type;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} required={props.required}>{label}</Label>
      <input
        id={fieldId}
        data-field
        {...(phone ? { type: "tel", inputMode: "tel" as const } : {})}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(
          "h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-ink placeholder:text-muted/70",
          error ? "border-danger" : "border-line hover:border-brand-300",
          className
        )}
        {...props}
      />
      {error && <p id={`${fieldId}-error`} className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string };

export function SelectField({ label, id, className, children, ...props }: SelectProps) {
  const fieldId = id ?? props.name;
  const error = useFieldError(props.name);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} required={props.required}>{label}</Label>
      <select
        id={fieldId}
        data-field
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn("h-11 w-full rounded-xl border bg-white px-3 text-sm", error ? "border-danger" : "border-line", className)}
        {...props}
      >
        {children}
      </select>
      {error && <p id={`${fieldId}-error`} className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

type AreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string };

export function TextareaField({ label, id, className, ...props }: AreaProps) {
  const fieldId = id ?? props.name;
  const error = useFieldError(props.name);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} required={props.required}>{label}</Label>
      <textarea
        id={fieldId}
        data-field
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        rows={3}
        className={cn("w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm", error ? "border-danger" : "border-line hover:border-brand-300", className)}
        {...props}
      />
      {error && <p id={`${fieldId}-error`} className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
