"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { useFieldError } from "@/components/ui/form";
import { phoneDigits } from "@/lib/phone";
import { phoneTakenAction } from "@/server/lead-actions";

/** The phone field. Once ten digits are typed it asks the server, and says right below the field if another lead already has the number. */
export function LeadPhone({ defaultValue, leadId = "", uid = "" }: { defaultValue?: string; leadId?: string; /** Makes the field id unique when several lead forms are on one page. */ uid?: string }) {
  const id = uid ? `phone-${uid}` : "phone";
  const error = useFieldError("phone");
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  function check(value: string) {
    clearTimeout(timer.current);
    const turn = ++latest.current;
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) delete input.dataset.taken;
    if (phoneDigits(value).length < 10) { setMessage(""); return; }
    timer.current = setTimeout(async () => {
      const result = await phoneTakenAction(value, leadId).catch(() => null);
      if (turn !== latest.current) return;
      const text = result?.taken ? result.message : "";
      setMessage(text);
      // The form reads this when "Add lead" is pressed, so a taken number cannot be submitted.
      const input = document.getElementById(id);
      if (input instanceof HTMLInputElement) { if (text) input.dataset.taken = text; else delete input.dataset.taken; }
    }, 250);
  }

  return (
    <div>
      <Field label="Phone" name="phone" id={id} inputMode="tel" placeholder="077-123-4567" defaultValue={defaultValue} required onChange={(event) => check(event.target.value)} />
      {message && !error && <p data-live role="alert" className="mt-1.5 text-xs font-medium text-danger">{message}</p>}
    </div>
  );
}
