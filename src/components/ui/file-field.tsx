"use client";

import { FileText, UploadCloud, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useFieldError } from "./form";
import { cn } from "@/lib/utils";

type Picked = { name: string; size: number; type: string; url: string };

const size = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Does this file match an `accept` list such as "image/png,application/pdf" or "image/*"? */
function allowed(file: File, accept: string) {
  if (!accept) return true;
  return accept.split(",").map((rule) => rule.trim().toLowerCase()).some((rule) => (rule.endsWith("/*") ? file.type.startsWith(rule.slice(0, -1)) : rule.startsWith(".") ? file.name.toLowerCase().endsWith(rule) : file.type === rule));
}

/**
 * Every file upload in the app. Click or drop a file, see its name, size and a preview, remove it again.
 * The real file input stays in the form, so the form sends it exactly as before.
 * Too-large or wrong-type files are refused on the spot with the reason shown below.
 */
export function FileField({ label, name, accept = "", hint, maxMb, multiple = false, required = false, compact = false }: {
  label: string; name: string; accept?: string; hint?: string; maxMb: number; multiple?: boolean; required?: boolean; compact?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [problem, setProblem] = useState("");
  const [over, setOver] = useState(false);
  const serverError = useFieldError(name);
  const error = problem || serverError;
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  /** Tells the form that its contents changed (the input is changed from code, which raises no event by itself). */
  const announce = () => input.current?.dispatchEvent(new Event("change", { bubbles: true }));

  function take(list: File[]) {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current = [];
    const wrong = list.find((file) => !allowed(file, accept));
    const big = list.find((file) => file.size > maxMb * 1024 * 1024);
    if (wrong || big) {
      if (input.current) input.current.value = "";
      setPicked([]);
      setProblem(wrong ? `"${wrong.name}" is not an accepted file type.` : `"${big?.name}" is larger than ${maxMb} MB.`);
      return;
    }
    setProblem("");
    setPicked(list.map((file) => {
      const url = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
      if (url) urls.current.push(url);
      return { name: file.name, size: file.size, type: file.type, url };
    }));
  }

  function clear() {
    if (input.current) input.current.value = "";
    take([]);
    announce();
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      </label>
      <div
        onDragOver={(event) => { event.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const files = Array.from(event.dataTransfer.files);
          if (!files.length || !input.current) return;
          const transfer = new DataTransfer();
          (multiple ? files : files.slice(0, 1)).forEach((file) => transfer.items.add(file));
          input.current.files = transfer.files;
          take(Array.from(transfer.files));
          announce();
        }}
        className={cn(
          "relative rounded-xl border-2 border-dashed bg-white transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200",
          error ? "border-danger" : over ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-300 hover:bg-brand-50/40"
        )}
      >
        <input
          ref={input}
          id={id}
          data-field
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => take(Array.from(event.target.files ?? []))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div className={cn("pointer-events-none flex items-center gap-3", compact ? "px-3 py-2.5" : "px-4 py-4")}>
          <span className={cn("grid shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700", compact ? "h-8 w-8" : "h-10 w-10")}><UploadCloud className={compact ? "h-4 w-4" : "h-5 w-5"} /></span>
          <span className="min-w-0 text-sm">
            <span className="block font-semibold text-ink">{picked.length ? (multiple ? "Add or change files" : "Change file") : (multiple ? "Choose files or drop them here" : "Choose a file or drop it here")}</span>
            <span className="block text-xs text-muted">{hint ?? `Up to ${maxMb} MB${multiple ? " each" : ""}`}</span>
          </span>
        </div>
      </div>
      {picked.length > 0 && (
        <ul className="space-y-1.5">
          {picked.map((file) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-2 text-sm">
              {file.url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={file.url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-brand-700"><FileText className="h-5 w-5" /></span>}
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{file.name}</span><span className="block text-xs text-muted">{size(file.size)}</span></span>
              {!multiple || picked.length === 1 ? <button type="button" onClick={clear} aria-label={`Remove ${file.name}`} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-white hover:text-danger"><X className="h-4 w-4" /></button> : null}
            </li>
          ))}
          {multiple && picked.length > 1 && <li><button type="button" onClick={clear} className="cursor-pointer text-xs font-semibold text-danger hover:underline">Remove all {picked.length} files</button></li>}
        </ul>
      )}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
