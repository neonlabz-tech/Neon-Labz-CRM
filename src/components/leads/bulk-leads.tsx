"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";
import { ConfirmButton } from "@/components/ui/confirm";
import { deleteLeadsAction } from "@/server/lead-actions";

/**
 * Wraps the lead table (give it a key that changes with the rows so ticks reset). Every row has a checkbox marked `data-lead`.
 * Ticking any shows a bar at the bottom of the screen with the count, select / unselect all and a delete button.
 */
export function BulkLeads({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [onPage, setOnPage] = useState(0);

  const boxes = () => [...(root.current?.querySelectorAll<HTMLInputElement>("input[data-lead]") ?? [])];
  const read = () => {
    setOnPage(new Set(boxes().map((box) => box.dataset.lead)).size);
    setSelected([...new Set(boxes().filter((box) => box.checked).map((box) => box.dataset.lead ?? ""))]);
  };
  const setAll = (checked: boolean) => { boxes().forEach((box) => { box.checked = checked; }); read(); };

  return (
    <div ref={root} onChange={read}>
      {children}
      {selected.length > 0 && (
        <div role="region" aria-label="Selected leads" className="fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm text-white shadow-2xl">
          <span className="font-semibold">{selected.length} selected</span>
          <button type="button" onClick={() => setAll(true)} disabled={selected.length === onPage} className="cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20 disabled:cursor-default disabled:opacity-40">Select all ({onPage})</button>
          <button type="button" onClick={() => setAll(false)} className="cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">Unselect all</button>
          <ConfirmButton
            variant="danger"
            label={`Delete (${selected.length})`}
            title={`Delete ${selected.length} lead${selected.length === 1 ? "" : "s"}?`}
            text="This cannot be undone. A lead's quotation is removed with it; leads with payment or receipt records are kept."
            confirmLabel="Delete"
            run={async () => { const result = await deleteLeadsAction(selected); setSelected([]); return result; }}
          />
          <button type="button" onClick={() => setAll(false)} aria-label="Clear selection" title="Clear selection" className="cursor-pointer rounded-lg p-1.5 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
