"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/projects";
import { moveTaskAction } from "@/server/task-actions";

type Props = { projectCode: string; status: TaskStatus; title: string; count: number; accepts: boolean; children: React.ReactNode };

/** One column of the board. A card dragged onto it moves to this status; the server still checks who may do that. */
export function TaskColumn({ projectCode, status, title, count, accepts, children }: Props) {
  const [over, setOver] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <div
      onDragOver={(event) => { if (accepts) { event.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        if (!accepts) return;
        event.preventDefault();
        const raw = event.dataTransfer.getData("application/x-neon-task");
        if (!raw) return;
        const { id, status: from } = JSON.parse(raw) as { id: string; status: string };
        if (from === status) return;
        start(async () => { const result = await moveTaskAction(projectCode, id, status); toast(result.ok, result.message); });
      }}
      className={cn("rounded-xl bg-canvas p-2.5 transition-colors", over && "bg-brand-100 ring-2 ring-brand-400", pending && "opacity-70")}
    >
      <p className="mb-2 flex justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted"><span>{title}</span><span>{count}</span></p>
      <div className="min-h-12 space-y-2">{children}</div>
    </div>
  );
}
