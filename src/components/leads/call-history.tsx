"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { CallFields } from "@/components/leads/call-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineForms } from "@/components/ui/dialog-shell";
import { ActionForm } from "@/components/ui/form";
import { addCallAction, updateCallAction } from "@/server/lead-actions";
import type { ActionState } from "@/types";

export type CallItem = { index: number; outcome: string; status: string; next: string; note: string; when: string };

type Props = { leadId: string; stage: string; today: string; outcomes: readonly string[]; stages: readonly string[]; calls: CallItem[] };

/** The call history of a lead. "+ Add log" adds a call in place, and every entry can be edited; only the latest can change the stage. */
export function CallHistory({ leadId, stage, today, outcomes, stages, calls }: Props) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const latest = calls.length - 1;

  const closing = (action: typeof addCallAction, close: () => void) => async (state: ActionState, data: FormData) => {
    const result = await action(state, data);
    if (result.ok) close();
    return result;
  };

  return (
    <InlineForms>
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Call history <span className="font-normal text-muted">· {calls.length} follow-up{calls.length === 1 ? "" : "s"}</span></h2>
      </div>

      {adding && (
        <div className="mb-3">
          <ActionForm action={closing(addCallAction, () => setAdding(false))} submit="Save log" onCancel={() => setAdding(false)} className="space-y-3">
            <input type="hidden" name="leadId" value={leadId} />
            <CallFields today={today} outcomes={outcomes} stages={stages} stage={stage} legend="New call log" />
          </ActionForm>
        </div>
      )}

      {calls.length === 0 && !adding && <p className="text-sm text-muted">No calls logged yet.</p>}
      <ol className="space-y-3">
        {[...calls].reverse().map((call) => (
          <li key={call.index} className="rounded-xl border border-line bg-white p-3 text-sm">
            {editing === call.index ? (
              <>
                <ActionForm action={closing(updateCallAction, () => setEditing(null))} submit="Save changes" onCancel={() => setEditing(null)} className="space-y-3">
                  <input type="hidden" name="leadId" value={leadId} />
                  <input type="hidden" name="index" value={call.index} />
                  <CallFields today={today} outcomes={outcomes} stages={stages} stage={stage} lockStage={call.index !== latest} defaults={{ outcome: call.outcome, status: call.status, next: call.next, note: call.note }} legend={`Edit call · ${call.when}`} />
                </ActionForm>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={call.outcome === "Answered" ? "success" : "warning"}>{call.outcome}</Badge>
                  <span className="font-semibold">{call.status}</span>
                  <span className="ml-auto text-xs text-muted">{call.when}</span>
                </div>
                {call.note && <p className="mt-1.5">{call.note}</p>}
                {call.next && <p className="mt-1.5 text-xs font-medium text-amber-600">Next follow-up: {call.next}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <button type="button" onClick={() => { setEditing(call.index); setAdding(false); }} className="inline-flex items-center gap-1 text-brand-700 hover:underline" aria-label={`Edit record #${call.index + 1}`}><Pencil className="h-3.5 w-3.5" />Edit record #{call.index + 1}</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
      {!adding && (
        <button type="button" onClick={() => { setAdding(true); setEditing(null); }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-400 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"><Plus className="h-4 w-4" />Add log</button>
      )}
    </div>
    </InlineForms>
  );
}
