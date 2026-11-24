"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; ok: boolean; message: string };
const ToastContext = createContext<(ok: boolean, message: string) => void>(() => undefined);

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const layer = useRef<HTMLDivElement>(null);
  const push = useCallback((ok: boolean, message: string) => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, ok, message }]);
    setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), 5000);
  }, []);

  // A modal <dialog> sits in the browser's top layer, above any z-index. Showing the toasts as a popover puts them in
  // that layer too, and showing it again on each change moves it above a dialog that was opened after it.
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (items.length) el.showPopover();
    } catch { /* popover not supported: the z-index below still applies */ }
  }, [items]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div ref={layer} popover="manual" style={{ inset: "1rem 1rem auto auto", margin: 0, padding: 0, border: 0, background: "transparent", overflow: "visible" }} className="fixed z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={cn("flex items-start gap-3 rounded-xl border bg-white p-3.5 text-sm shadow-lg", item.ok ? "border-success/30" : "border-danger/30")}>
            {item.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />}
            <p className="text-ink">{item.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
