"use client";

import { useState } from "react";
import { Field, SelectField, TextareaField } from "@/components/ui/field";

type Defaults = { outcome?: string; status?: string; next?: string; note?: string };

/**
 * The "log a call" fields: result (Answered or Not Answered), the stage after the call, the next follow-up and a note.
 * A call that was not answered cannot change the stage, and the next follow-up cannot be in the past.
 * `lockStage` freezes the stage (an older history entry); the stage then keeps what was saved.
 */
export function CallFields({ today, outcomes, stages, stage, defaults = {}, lockStage = false, legend = "Log a call" }: {
  today: string; outcomes: readonly string[]; stages: readonly string[]; stage: string; defaults?: Defaults; lockStage?: boolean; legend?: string;
}) {
  const [outcome, setOutcome] = useState(defaults.outcome ?? "Answered");
  const frozen = outcome === "Not Answered" || lockStage;
  return (
    <fieldset className="rounded-2xl border border-line bg-brand-50/40 p-4">
      <legend className="px-2 text-sm font-semibold">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Call result" name="callOutcome" required defaultValue={defaults.outcome ?? "Answered"} onChange={(event) => setOutcome(event.target.value)}>
          {outcomes.map((o) => <option key={o}>{o}</option>)}
        </SelectField>
        <div>
          <SelectField label="Stage after the call" name="callStatus" defaultValue={defaults.status ?? stage} disabled={frozen} className="disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted">
            {stages.map((s) => <option key={s}>{s}</option>)}
          </SelectField>
          {frozen && <p className="mt-1 text-xs text-muted">{lockStage ? "Only the latest call can change the stage." : "The stage stays the same when the call was not answered."}</p>}
        </div>
        <Field label="Next follow-up" name="callNext" type="date" min={defaults.next && defaults.next < today ? defaults.next : today} defaultValue={defaults.next ?? ""} />
        <TextareaField label="Call note" name="callNote" rows={2} defaultValue={defaults.note ?? ""} />
      </div>
    </fieldset>
  );
}
