"use client";

import { useState } from "react";
import { Field, SelectField, TextareaField } from "@/components/ui/field";

/** The optional "log a call" part of the lead form. A call that was not answered cannot change the stage, and the next follow-up cannot be in the past. */
export function CallFields({ today, outcomes, stages }: { today: string; outcomes: readonly string[]; stages: readonly string[] }) {
  const [outcome, setOutcome] = useState("");
  const unanswered = outcome === "Not Answered";
  return (
    <fieldset className="rounded-2xl border border-line bg-brand-50/40 p-4">
      <legend className="px-2 text-sm font-semibold">Log a call (optional)</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Call result" name="callOutcome" defaultValue="" onChange={(event) => setOutcome(event.target.value)}>
          <option value="">No call to log</option>
          {outcomes.map((o) => <option key={o}>{o}</option>)}
        </SelectField>
        <div>
          <SelectField label="Stage after the call" name="callStatus" defaultValue="" disabled={unanswered} className="disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted">
            <option value="">Keep the current stage</option>
            {stages.map((s) => <option key={s}>{s}</option>)}
          </SelectField>
          {unanswered && <p className="mt-1 text-xs text-muted">The stage stays the same when the call was not answered.</p>}
        </div>
        <Field label="Next follow-up" name="callNext" type="date" min={today} />
        <TextareaField label="Call note" name="callNote" rows={2} />
      </div>
    </fieldset>
  );
}
