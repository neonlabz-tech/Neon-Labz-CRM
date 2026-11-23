"use client";

import { X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useFieldError } from "./form";
import { cn } from "@/lib/utils";

/** Puts a value into an input the way typing would, so the form notices the change. */
function setValue(el: HTMLInputElement | null, value: string) {
  if (!el) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const box = (error: boolean) => cn("w-full rounded-xl border bg-white text-sm text-ink", error ? "border-danger" : "border-line hover:border-brand-300");

function Label({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
      {children}
      {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
    </label>
  );
}

/** `inline` puts the list in the page flow, so a window grows to hold it instead of cutting it off behind its buttons. */
function List({ id, items, active, onPick, inline }: { id: string; items: string[]; active: number; onPick: (value: string) => void; inline?: boolean }) {
  if (!items.length) return null;
  return (
    <ul id={id} role="listbox" className={cn("mt-1 max-h-56 overflow-auto rounded-xl border border-line bg-white p-1 shadow-lg", !inline && "absolute left-0 right-0 top-full z-30")}>
      {items.map((item, index) => (
        <li key={item} role="option" aria-selected={index === active} onMouseDown={(event) => { event.preventDefault(); onPick(item); }} className={cn("cursor-pointer rounded-lg px-3 py-2 text-sm", index === active ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-brand-50")}>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** With `all`, an empty box lists every option, so a person can pick without typing. */
const match = (options: string[], query: string, skip: string[] = [], all = false) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return all ? options.filter((option) => !skip.includes(option)).slice(0, 60) : [];
  return options.filter((option) => !skip.includes(option) && option.toLowerCase().includes(needle) && option.toLowerCase() !== needle).slice(0, all ? 60 : 8);
};

/** A text box that suggests matching names while the person types. Anything can still be typed. */
export function SuggestField({ label, name, options, required, placeholder, defaultValue, maxLength, openOnFocus }: {
  label: string; name: string; options: string[]; required?: boolean; placeholder?: string; defaultValue?: string; maxLength?: number;
  /** Lists every option as soon as the box is clicked. */ openOnFocus?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const error = useFieldError(name);
  const items = open ? match(options, query, [], Boolean(openOnFocus)) : [];

  function pick(value: string) {
    setValue(input.current, value);
    setQuery(value);
    setOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>{label}</Label>
      <div className="relative">
        <input
          ref={input}
          id={id}
          data-field
          name={name}
          required={required}
          maxLength={maxLength}
          placeholder={placeholder}
          defaultValue={defaultValue}
          autoComplete="off"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={`${id}-list`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onInput={(event) => { setQuery(event.currentTarget.value); setOpen(true); setActive(0); }}
          onFocus={() => { if (openOnFocus) { setOpen(true); setActive(0); } }}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (!items.length) return;
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((active + 1) % items.length); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setActive((active - 1 + items.length) % items.length); }
            else if (event.key === "Enter") { event.preventDefault(); pick(items[active] ?? items[0]!); }
            else if (event.key === "Escape") { event.stopPropagation(); setOpen(false); }
          }}
          className={cn(box(Boolean(error)), "h-11 px-3.5 placeholder:text-muted/70")}
        />
        <List id={`${id}-list`} items={items} active={active} onPick={pick} />
      </div>
      {error && <p id={`${id}-error`} className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

/**
 * Several values in one field: matching names are suggested while typing, each pick becomes a chip,
 * and a name that is not in the list can be added with Enter or a comma. The form receives them joined by ", ".
 */
export function MultiSuggestField({ label, name, options, required, placeholder, defaultValue }: {
  label: string; name: string; options: string[]; required?: boolean; placeholder?: string; defaultValue?: string;
}) {
  const id = useId();
  const typing = useRef<HTMLInputElement>(null);
  const joined = useRef<HTMLInputElement>(null);
  const [chips, setChips] = useState<string[]>(() => (defaultValue ?? "").split(",").map((part) => part.trim()).filter(Boolean));
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const error = useFieldError(name);
  const items = open ? match(options, text, chips, true) : [];

  /** The form always gets the chips plus whatever is still being typed, so nothing is lost on Save. */
  const send = (list: string[], pending: string) => setValue(joined.current, [...list, pending.trim()].filter(Boolean).join(", "));

  function add(value: string) {
    const clean = value.trim();
    if (!clean || chips.some((chip) => chip.toLowerCase() === clean.toLowerCase())) { setText(""); send(chips, ""); return; }
    const next = [...chips, clean];
    setChips(next);
    setText("");
    setOpen(false);
    send(next, "");
  }

  function remove(index: number) {
    const next = chips.filter((_, i) => i !== index);
    setChips(next);
    send(next, text);
    typing.current?.focus();
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-value`} required={required}>{label}</Label>
      <div className="relative">
        {/* The value the form sends. The person types in the box below; focus (for example from a validation message) is passed on. */}
        <input ref={joined} id={`${id}-value`} data-field name={name} required={required} defaultValue={chips.join(", ")} readOnly tabIndex={-1} aria-hidden="true" onFocus={() => typing.current?.focus()} className="pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0" />
        <div onClick={() => { typing.current?.focus(); setOpen(true); }} className={cn(box(Boolean(error)), "flex min-h-11 flex-wrap items-center gap-1.5 px-2.5 py-1.5 focus-within:border-brand-500")}>
          {chips.map((chip, index) => (
            <span key={chip} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-brand-700">
              <span className="truncate">{chip}</span>
              <button type="button" onClick={(event) => { event.stopPropagation(); remove(index); }} aria-label={`Remove ${chip}`} className="grid h-5 w-5 cursor-pointer place-items-center rounded-md hover:bg-brand-100"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <input
            ref={typing}
            id={id}
            value={text}
            placeholder={chips.length ? "Add another" : placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={`${id}-list`}
            onChange={(event) => {
              const value = event.target.value;
              if (value.includes(",")) { value.split(",").forEach((part, i, all) => { if (i < all.length - 1) add(part); else setText(part); }); return; }
              setText(value); setOpen(true); setActive(0); send(chips, value);
            }}
            onFocus={() => { setOpen(true); setActive(0); }}
            onClick={() => setOpen(true)}
            onBlur={() => { setOpen(false); if (text.trim()) add(text); }}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); add(items[active] ?? text); }
              else if (event.key === "ArrowDown" && items.length) { event.preventDefault(); setActive((active + 1) % items.length); }
              else if (event.key === "ArrowUp" && items.length) { event.preventDefault(); setActive((active - 1 + items.length) % items.length); }
              else if (event.key === "Backspace" && !text && chips.length) remove(chips.length - 1);
              else if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); }
            }}
            className="h-8 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted/70"
          />
        </div>
        <List id={`${id}-list`} items={items} active={active} onPick={add} inline />
      </div>
      {error && <p id={`${id}-error`} className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
