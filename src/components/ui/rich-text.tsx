"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Link2, List, ListOrdered, Redo2, RemoveFormatting, Table as TableIcon, Underline, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FONTS = [["", "Font"], ["Arial, sans-serif", "Arial"], ["Georgia, serif", "Georgia"], ["'Times New Roman', Times, serif", "Times New Roman"], ["'Courier New', Courier, monospace", "Courier New"]] as const;
const SIZES = [["", "Size"], ["10px", "Small"], ["13px", "Normal"], ["16px", "Large"], ["24px", "X-large"], ["32px", "XX-large"]] as const;
const COLORS = ["#1c2142", "#000000", "#666666", "#7a2bf0", "#c711fc", "#1857b8", "#0b7a55", "#b42318", "#f59e0b"];
const ALLOWED_TAGS = new Set(["a", "b", "blockquote", "br", "code", "div", "em", "font", "h1", "h2", "h3", "h4", "i", "li", "ol", "p", "span", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "u", "ul"]);
const tool = "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs text-ink hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4";

type Props = {
  label?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
};

function safePasteHtml(value: string): string {
  const parsed = new DOMParser().parseFromString(value, "text/html");
  for (const element of [...parsed.body.querySelectorAll("*")] as HTMLElement[]) {
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH"].includes(element.tagName)) {
      element.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(element.tagName.toLowerCase())) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const key = attribute.name.toLowerCase();
      if (key === "style") {
        const safe: string[] = [];
        for (const [property, raw] of [...element.style].map((property) => [property, element.style.getPropertyValue(property)] as const)) {
          const current = raw.trim();
          const valid =
            (property === "color" || property === "background-color") && /^(#[\da-f]{3,8}|rgb\(\s*[\d\s,.%]+\)|[a-z]{3,20})$/i.test(current)
            || property === "font-size" && /^\d{1,3}(\.\d+)?(px|pt|em|rem|%)$/i.test(current)
            || property === "font-family" && /^[\w\s,"'-]{1,120}$/.test(current)
            || property === "text-align" && /^(left|right|center|justify)$/i.test(current)
            || property === "font-weight" && /^(bold|normal|[1-9]00)$/i.test(current)
            || property === "font-style" && /^(italic|normal)$/i.test(current)
            || property === "text-decoration" && /^(underline|line-through)$/i.test(current)
            || property === "width" && /^\d{1,3}(\.\d+)?(px|%|mm|cm)$/i.test(current)
            || property === "vertical-align" && /^(top|middle|bottom)$/i.test(current)
            || property === "border" && /^\d{1,2}px\s+(solid|dashed|dotted)\s+(#[\da-f]{3,8}|[a-z]{3,20})$/i.test(current)
            || property === "padding" && /^\d{1,2}px(\s+\d{1,2}px){0,3}$/i.test(current);
          if (valid) safe.push(`${property}: ${current}`);
        }
        if (safe.length) element.setAttribute("style", safe.join("; "));
        else element.removeAttribute("style");
        continue;
      }
      if ((element.tagName === "TD" || element.tagName === "TH") && ["colspan", "rowspan"].includes(key) && /^\d{1,2}$/.test(attribute.value)) continue;
      if (element.tagName === "A" && ["href", "title"].includes(key)) {
        if (key === "href") {
          try {
            const url = new URL(attribute.value, window.location.origin);
            if (!["http:", "https:", "mailto:"].includes(url.protocol)) element.removeAttribute(attribute.name);
          } catch {
            element.removeAttribute(attribute.name);
          }
        }
        continue;
      }
      element.removeAttribute(attribute.name);
    }
    if (element.tagName === "FONT") {
      const span = parsed.createElement("span");
      if (element.hasAttribute("style")) span.setAttribute("style", element.getAttribute("style") ?? "");
      span.replaceChildren(...Array.from(element.childNodes));
      element.replaceWith(span);
    }
    if (element.tagName === "A") {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  }
  return parsed.body.innerHTML;
}

/** A small editor for formatted text with safe paste, table tools and history. */
export function RichText({ label, name, value, defaultValue = "", onChange, placeholder, minHeight = "6rem" }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const [html, setHtml] = useState(value ?? defaultValue);
  const [historyStatus, setHistoryStatus] = useState({ canUndo: false, canRedo: false });
  const [tableMessage, setTableMessage] = useState("");
  const current = value ?? html;
  const canUndo = historyStatus.canUndo;
  const canRedo = historyStatus.canRedo;
  const refreshHistory = () => setHistoryStatus({
    canUndo: historyIndex.current > 0,
    canRedo: historyIndex.current >= 0 && historyIndex.current < history.current.length - 1,
  });

  useEffect(() => {
    if (!surface.current || surface.current.innerHTML === current) return;
    surface.current.innerHTML = current;
    history.current = [current];
    historyIndex.current = 0;
    refreshHistory();
  }, [current]);

  const remember = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && surface.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      saved.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const getRange = (): Range | null => {
    const selection = window.getSelection();
    if (selection?.rangeCount && surface.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      return selection.getRangeAt(0).cloneRange();
    }
    if (saved.current && surface.current?.contains(saved.current.commonAncestorContainer)) return saved.current.cloneRange();
    if (!surface.current) return null;
    const range = document.createRange();
    range.selectNodeContents(surface.current);
    range.collapse(false);
    return range;
  };

  const setSelection = (range: Range) => {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    saved.current = range.cloneRange();
  };

  const emit = () => {
    if (!surface.current) return;
    const empty = !(surface.current.textContent ?? "").trim() && !surface.current.querySelector("li, table");
    const next = empty ? "" : surface.current.innerHTML;
    if (empty) surface.current.innerHTML = "";
    if (history.current[historyIndex.current] !== next) {
      history.current = history.current.slice(0, historyIndex.current + 1);
      history.current.push(next);
      if (history.current.length > 60) history.current.shift();
      historyIndex.current = history.current.length - 1;
      refreshHistory();
    }
    setHtml(next);
    onChange?.(next);
  };

  const insertHtml = (htmlValue: string) => {
    const range = getRange();
    if (!range || !surface.current) return false;
    range.deleteContents();
    const template = document.createElement("template");
    template.innerHTML = htmlValue;
    const fragment = template.content;
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      setSelection(range);
    }
    return true;
  };

  const selectedCell = (): HTMLTableCellElement | null => {
    const range = getRange();
    const anchor = range?.startContainer ?? null;
    const node = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement | null;
    const cell = node?.closest("td, th") as HTMLTableCellElement | null;
    return cell && surface.current?.contains(cell) ? cell : null;
  };

  const applyInline = (tag: string, style?: [string, string], href?: string) => {
    const range = getRange();
    if (!range || !surface.current) return;
    const parent = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer as HTMLElement;
    const existing = parent?.closest(tag);
    if (range.collapsed && existing && surface.current.contains(existing)) {
      existing.replaceWith(...Array.from(existing.childNodes));
      emit();
      return;
    }
    const wrap = (textNode: Text) => {
      const wrapper = document.createElement(tag);
      if (style) wrapper.style.setProperty(style[0], style[1]);
      if (href) {
        wrapper.setAttribute("href", href);
        wrapper.setAttribute("target", "_blank");
        wrapper.setAttribute("rel", "noopener noreferrer");
      }
      textNode.parentNode?.insertBefore(wrapper, textNode);
      wrapper.appendChild(textNode);
      return wrapper;
    };
    if (range.collapsed) {
      const wrapper = document.createElement(tag);
      if (style) wrapper.style.setProperty(style[0], style[1]);
      if (href) {
        wrapper.setAttribute("href", href);
        wrapper.setAttribute("target", "_blank");
        wrapper.setAttribute("rel", "noopener noreferrer");
      }
      wrapper.appendChild(document.createElement("br"));
      range.insertNode(wrapper);
      const caret = document.createRange();
      caret.setStart(wrapper, 0);
      caret.collapse(true);
      setSelection(caret);
      emit();
      return;
    }
    const walker = document.createTreeWalker(surface.current, NodeFilter.SHOW_TEXT);
    const targets: { node: Text; start: number; end: number }[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!range.intersectsNode(node)) continue;
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      if (start < end) targets.push({ node, start, end });
    }
    const wrappers: HTMLElement[] = [];
    for (const target of targets.reverse()) {
      let selected = target.node;
      if (target.start > 0) selected = selected.splitText(target.start);
      if (target.end - target.start < selected.length) selected.splitText(target.end - target.start);
      wrappers.push(wrap(selected));
    }
    if (wrappers.length) {
      const ordered = wrappers.reverse();
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      if (!first || !last) return;
      const selection = document.createRange();
      selection.setStartBefore(first);
      selection.setEndAfter(last);
      setSelection(selection);
      emit();
    }
  };

  const list = (tag: "ul" | "ol") => {
    const range = getRange();
    if (!range || !surface.current) return;
    const candidates = [...surface.current.querySelectorAll("p, div, li")].filter((element) => {
      try { return range.intersectsNode(element); } catch { return false; }
    });
    const blocks = candidates.filter((element) => {
      const listItem = element.closest("li");
      if (listItem && listItem !== element && candidates.includes(listItem)) return false;
      return !candidates.some((other) => other !== element && element.contains(other));
    });
    if (!blocks.length) {
      const anchor = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer as HTMLElement;
      const block = anchor?.closest("p, div, li");
      if (block && block !== surface.current && surface.current.contains(block)) blocks.push(block);
    }
    if (!blocks.length) {
      setTableMessage("Select a line in the editor before adding a list.");
      return;
    }
    const processedLists = new Set<Element>();
    for (const block of blocks) {
      const existing = block.closest("ul, ol");
      if (block.tagName === "LI" && existing) {
        if (processedLists.has(existing)) continue;
        processedLists.add(existing);
        if (existing.tagName.toLowerCase() === tag) {
          for (const item of Array.from(existing.children)) {
            const paragraph = document.createElement("div");
            paragraph.replaceChildren(...Array.from(item.childNodes));
            item.replaceWith(paragraph);
          }
          existing.replaceWith(...Array.from(existing.childNodes));
        } else {
          const replacement = document.createElement(tag);
          replacement.replaceChildren(...Array.from(existing.childNodes));
          existing.replaceWith(replacement);
        }
      } else {
        const listElement = document.createElement(tag);
        const item = document.createElement("li");
        item.replaceChildren(...Array.from(block.childNodes));
        block.replaceWith(listElement);
        listElement.appendChild(item);
      }
    }
    setTableMessage("");
    emit();
  };

  const align = (value: string) => {
    const range = getRange();
    if (!range || !surface.current) return;
    const blocks = [...surface.current.querySelectorAll("p, div, li, td, th")].filter((element) => {
      try { return range.intersectsNode(element); } catch { return false; }
    });
    const anchor = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer as HTMLElement;
    const target = blocks.length ? blocks : [anchor?.closest("p, div, li, td, th") ?? surface.current];
    target.forEach((element) => { (element as HTMLElement).style.textAlign = value; });
    emit();
  };

  const insertTable = () => {
    const head = document.createElement("thead");
    const header = document.createElement("tr");
    for (const title of ["Item", "Details", "Notes"]) {
      const cell = document.createElement("th");
      cell.textContent = title;
      header.appendChild(cell);
    }
    head.appendChild(header);
    const body = document.createElement("tbody");
    for (let rowIndex = 0; rowIndex < 2; rowIndex += 1) {
      const row = document.createElement("tr");
      for (let colIndex = 0; colIndex < 3; colIndex += 1) {
        const cell = document.createElement("td");
        cell.appendChild(document.createElement("br"));
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    const table = document.createElement("table");
    table.append(head, body);
    const range = getRange();
    if (!range) return;
    range.deleteContents();
    range.insertNode(table);
    const caret = document.createRange();
    const firstCell = body.rows[0]?.cells[0];
    if (!firstCell) return;
    caret.selectNodeContents(firstCell);
    caret.collapse(true);
    setSelection(caret);
    setTableMessage("");
    emit();
  };

  const tableAction = (action: "row" | "col" | "deleteRow" | "deleteCol" | "header" | "merge") => {
    const cell = selectedCell();
    if (!cell) {
      setTableMessage("Place the cursor inside a table cell first.");
      return;
    }
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row.closest("table");
    if (!table) return;
    if (action === "row") {
      const next = document.createElement("tr");
      Array.from(row.cells).forEach((currentCell) => {
        const made = document.createElement("td");
        made.appendChild(document.createElement("br"));
        next.appendChild(made);
      });
      if (row.parentElement?.tagName === "THEAD" && table.tBodies[0]) table.tBodies[0].insertBefore(next, table.tBodies[0].firstChild);
      else row.after(next);
    } else if (action === "col") {
      for (const currentRow of Array.from(table.rows)) {
        const made = document.createElement(currentRow.cells[0]?.tagName === "TH" ? "th" : "td");
        made.appendChild(document.createElement("br"));
        const nextCell = currentRow.cells[cell.cellIndex];
        if (nextCell) nextCell.after(made);
        else currentRow.appendChild(made);
      }
    } else if (action === "deleteRow") {
      row.remove();
      if (!table.rows.length) table.remove();
    } else if (action === "deleteCol") {
      for (const currentRow of Array.from(table.rows)) currentRow.cells[cell.cellIndex]?.remove();
      if (!table.querySelector("td, th")) table.remove();
    } else if (action === "header") {
      const tag = cell.tagName === "TH" ? "td" : "th";
      for (const currentCell of Array.from(row.cells)) {
        const replacement = document.createElement(tag);
        replacement.replaceChildren(...Array.from(currentCell.childNodes));
        replacement.style.cssText = currentCell.style.cssText;
        currentCell.replaceWith(replacement);
      }
      if (tag === "th" && row.parentElement?.tagName !== "THEAD") {
        const head = table.tHead ?? table.createTHead();
        head.appendChild(row);
      } else if (tag === "td" && row.parentElement?.tagName === "THEAD") {
        const body = table.tBodies[0] ?? table.createTBody();
        body.insertBefore(row, body.firstChild);
      }
    } else {
      const next = cell.nextElementSibling as HTMLTableCellElement | null;
      if (!next || !["TD", "TH"].includes(next.tagName)) {
        setTableMessage("Choose a cell with another cell to its right to merge.");
        return;
      }
      const colspan = Number(cell.getAttribute("colspan") ?? 1) + Number(next.getAttribute("colspan") ?? 1);
      cell.setAttribute("colspan", String(colspan));
      if (cell.childNodes.length && next.childNodes.length) cell.appendChild(document.createElement("br"));
      cell.append(...Array.from(next.childNodes));
      next.remove();
    }
    setTableMessage("");
    emit();
  };

  const setColumnWidth = (width: string) => {
    const cell = selectedCell();
    if (!cell) {
      setTableMessage("Place the cursor inside a table cell first.");
      return;
    }
    const table = cell.closest("table");
    if (!table) return;
    for (const row of Array.from(table.rows)) {
      const column = row.cells[cell.cellIndex];
      if (column) column.style.width = width;
    }
    setTableMessage("");
    emit();
  };

  const undo = () => {
    if (!canUndo || !surface.current) return;
    historyIndex.current -= 1;
    const previous = history.current[historyIndex.current] ?? "";
    surface.current.innerHTML = previous;
    setHtml(previous);
    onChange?.(previous);
    refreshHistory();
    saved.current = null;
  };

  const redo = () => {
    if (!canRedo || !surface.current) return;
    historyIndex.current += 1;
    const next = history.current[historyIndex.current] ?? "";
    surface.current.innerHTML = next;
    setHtml(next);
    onChange?.(next);
    refreshHistory();
    saved.current = null;
  };

  const addLink = () => {
    const raw = window.prompt("Enter a link URL");
    if (!raw) return;
    let url: URL;
    try { url = new URL(raw, window.location.origin); } catch { setTableMessage("Enter a valid http, https or mailto link."); return; }
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
      setTableMessage("Only http, https and mailto links are allowed.");
      return;
    }
    setTableMessage("");
    applyInline("a", undefined, url.href);
  };

  const paste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pastedHtml = event.clipboardData.getData("text/html");
    if (pastedHtml) {
      insertHtml(safePasteHtml(pastedHtml));
    } else {
      const text = event.clipboardData.getData("text/plain");
      const content = text.split(/\r?\n/).map((line) => `<div>${line.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char) || "<br>"}</div>`).join("");
      insertHtml(content);
    }
    emit();
  };

  return (
    <div className="space-y-1.5">
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
      <div className="overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand-400">
        <div className="flex flex-wrap items-center gap-1 border-b border-line bg-brand-50/50 px-2 py-1.5">
          <button type="button" className={tool} aria-label="Undo" title="Undo" disabled={!canUndo} onMouseDown={(event) => event.preventDefault()} onClick={undo}><Undo2 /></button>
          <button type="button" className={tool} aria-label="Redo" title="Redo" disabled={!canRedo} onMouseDown={(event) => event.preventDefault()} onClick={redo}><Redo2 /></button>
          <button type="button" className={tool} aria-label="Bold" title="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => applyInline("strong")}><Bold /></button>
          <button type="button" className={tool} aria-label="Italic" title="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => applyInline("em")}><Italic /></button>
          <button type="button" className={tool} aria-label="Underline" title="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyInline("u")}><Underline /></button>
          <button type="button" className={tool} aria-label="Bullet list" title="Bullet list" onMouseDown={(event) => event.preventDefault()} onClick={() => list("ul")}><List /></button>
          <button type="button" className={tool} aria-label="Numbered list" title="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={() => list("ol")}><ListOrdered /></button>
          <button type="button" className={tool} aria-label="Align left" title="Align left" onMouseDown={(event) => event.preventDefault()} onClick={() => align("left")}><AlignLeft /></button>
          <button type="button" className={tool} aria-label="Align centre" title="Align centre" onMouseDown={(event) => event.preventDefault()} onClick={() => align("center")}><AlignCenter /></button>
          <button type="button" className={tool} aria-label="Align right" title="Align right" onMouseDown={(event) => event.preventDefault()} onClick={() => align("right")}><AlignRight /></button>
          <button type="button" className={tool} aria-label="Insert link" title="Insert link" onMouseDown={(event) => event.preventDefault()} onClick={addLink}><Link2 /></button>
          <button type="button" className={tool} aria-label="Insert table" title="Insert table" onMouseDown={(event) => event.preventDefault()} onClick={insertTable}><TableIcon /></button>
          <button type="button" className={tool} aria-label="Add row" title="Add a row under the cursor" onMouseDown={(event) => event.preventDefault()} onClick={() => tableAction("row")}>+Row</button>
          <button type="button" className={tool} aria-label="Add column" title="Add a column next to the cursor" onMouseDown={(event) => event.preventDefault()} onClick={() => tableAction("col")}>+Col</button>
          <button type="button" className={tool} aria-label="Delete row" title="Delete the current row" onMouseDown={(event) => event.preventDefault()} onClick={() => tableAction("deleteRow")}>−Row</button>
          <button type="button" className={tool} aria-label="Delete column" title="Delete the current column" onMouseDown={(event) => event.preventDefault()} onClick={() => tableAction("deleteCol")}>−Col</button>
          <button type="button" className={tool} aria-label="Toggle header" title="Toggle header cells in this row" onMouseDown={(event) => event.preventDefault()} onClick={() => tableAction("header")}>Header</button>
          <button type="button" className={tool} aria-label="Merge with cell to the right" title="Merge with cell to the right" onMouseDown={(event) => event.preventDefault()} onClick={() => tableAction("merge")}>Merge</button>
          <select aria-label="Column width" className="h-8 rounded-lg border border-line bg-white px-1.5 text-xs" defaultValue="" onChange={(event) => { if (event.target.value) setColumnWidth(event.target.value); event.target.value = ""; }}>
            <option value="">Column width</option><option value="20%">20%</option><option value="25%">25%</option><option value="33%">33%</option><option value="50%">50%</option><option value="75%">75%</option>
          </select>
          <select aria-label="Font" className="h-8 rounded-lg border border-line bg-white px-1.5 text-xs" defaultValue="" onChange={(event) => { if (event.target.value) applyInline("span", ["font-family", event.target.value]); event.target.value = ""; }}>
            {FONTS.map(([font, title]) => <option key={title} value={font}>{title}</option>)}
          </select>
          <select aria-label="Font size" className="h-8 rounded-lg border border-line bg-white px-1.5 text-xs" defaultValue="" onChange={(event) => { if (event.target.value) applyInline("span", ["font-size", event.target.value]); event.target.value = ""; }}>
            {SIZES.map(([size, title]) => <option key={title} value={size}>{title}</option>)}
          </select>
          <span className="flex items-center gap-1 px-1" role="group" aria-label="Text colour">
            {COLORS.map((color) => <button key={color} type="button" aria-label={`Colour ${color}`} title={color} onMouseDown={(event) => event.preventDefault()} onClick={() => applyInline("span", ["color", color])} className="h-5 w-5 cursor-pointer rounded-full border border-line" style={{ background: color }} />)}
          </span>
          <button type="button" className={tool} aria-label="Clear formatting" title="Clear formatting" onMouseDown={(event) => event.preventDefault()} onClick={() => {
            const range = getRange();
            const anchor = range?.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range?.startContainer as HTMLElement | null;
            const wrapper = anchor?.closest("strong, b, em, i, u, span, a");
            if (wrapper && surface.current?.contains(wrapper)) {
              wrapper.replaceWith(...Array.from(wrapper.childNodes));
              emit();
            }
          }}><RemoveFormatting /></button>
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
          onPaste={paste}
          onBlur={(event) => {
            const toolbar = surface.current?.previousElementSibling;
            if (event.relatedTarget instanceof Node && toolbar?.contains(event.relatedTarget)) remember();
            else saved.current = null;
            emit();
          }}
          onKeyUp={remember}
          onMouseUp={remember}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
              event.preventDefault();
              event.shiftKey ? redo() : undo();
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
              event.preventDefault();
              redo();
            }
          }}
          className={cn("rich max-w-none px-3.5 py-2.5 text-sm outline-none empty:before:text-muted/70 empty:before:content-[attr(data-placeholder)]")}
          style={{ minHeight }}
        />
      </div>
      {tableMessage && <p role="status" className="text-xs text-danger">{tableMessage}</p>}
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}
