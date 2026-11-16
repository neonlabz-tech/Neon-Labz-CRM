"use client";

import { Bold, Italic, List, ListOrdered, RemoveFormatting, Underline } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FONTS = [["", "Font"], ["Arial, sans-serif", "Arial"], ["Georgia, serif", "Georgia"], ["'Times New Roman', Times, serif", "Times New Roman"], ["'Courier New', Courier, monospace", "Courier New"]] as const;
const SIZES = [["", "Size"], ["2", "Small"], ["3", "Normal"], ["4", "Large"], ["5", "X-large"], ["6", "XX-large"]] as const;
const COLORS = ["#1c2142", "#000000", "#666666", "#7a2bf0", "#c711fc", "#1857b8", "#0b7a55", "#b42318", "#f59e0b"];

type Props = {
  label?: string;
  /** With a name the editor also writes its HTML into a hidden field, so it works inside a normal form. */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
};

const tool = "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs text-ink hover:bg-brand-50 [&_svg]:h-4 [&_svg]:w-4";

/** A small editor for formatted text: bold, italic, underline, lists, font, size and colour. */
export function RichText({ label, name, value, defaultValue = "", onChange, placeholder, minHeight = "6rem" }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const [html, setHtml] = useState(value ?? defaultValue);
  const current = value ?? html;

  useEffect(() => {
    if (surface.current && surface.current.innerHTML !== current) surface.current.innerHTML = current;
  }, [current]);

  const emit = () => {
    const next = surface.current?.innerHTML ?? "";
    const empty = !(surface.current?.textContent ?? "").trim() && !next.includes("<li");
    const clean = empty ? "" : next;
    setHtml(clean);
    onChange?.(clean);
  };
  const remember = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && surface.current?.contains(selection.anchorNode)) saved.current = selection.getRangeAt(0).cloneRange();
  };
  const run = (command: string, argument?: string) => {
    surface.current?.focus();
    const selection = window.getSelection();
    if (saved.current && selection) { selection.removeAllRanges(); selection.addRange(saved.current); }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, argument);
    remember();
    emit();
  };

  return (
    <div className="space-y-1.5">
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
      <div className="overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand-400">
        <div className="flex flex-wrap items-center gap-1 border-b border-line bg-brand-50/50 px-2 py-1.5">
          <button type="button" className={tool} aria-label="Bold" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => run("bold")}><Bold /></button>
          <button type="button" className={tool} aria-label="Italic" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => run("italic")}><Italic /></button>
          <button type="button" className={tool} aria-label="Underline" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => run("underline")}><Underline /></button>
          <button type="button" className={tool} aria-label="Bullet list" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => run("insertUnorderedList")}><List /></button>
          <button type="button" className={tool} aria-label="Numbered list" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => run("insertOrderedList")}><ListOrdered /></button>
          <select aria-label="Font" className="h-8 rounded-lg border border-line bg-white px-1.5 text-xs" value="" onChange={(e) => e.target.value && run("fontName", e.target.value)}>
            {FONTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
          </select>
          <select aria-label="Size" className="h-8 rounded-lg border border-line bg-white px-1.5 text-xs" value="" onChange={(e) => e.target.value && run("fontSize", e.target.value)}>
            {SIZES.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
          </select>
          <span className="flex items-center gap-1 px-1" role="group" aria-label="Text colour">
            {COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} title={c} onMouseDown={(e) => e.preventDefault()} onClick={() => run("foreColor", c)} className="h-5 w-5 cursor-pointer rounded-full border border-line" style={{ background: c }} />)}
          </span>
          <button type="button" className={tool} aria-label="Clear formatting" title="Clear formatting" onMouseDown={(e) => e.preventDefault()} onClick={() => run("removeFormat")}><RemoveFormatting /></button>
        </div>
        <div
          ref={surface}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={label ?? "Formatted text"}
          data-placeholder={placeholder}
          onInput={emit}
          onBlur={() => { remember(); emit(); }}
          onKeyUp={remember}
          onMouseUp={remember}
          className={cn("rich max-w-none px-3.5 py-2.5 text-sm outline-none empty:before:text-muted/70 empty:before:content-[attr(data-placeholder)]")}
          style={{ minHeight }}
        />
      </div>
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}
