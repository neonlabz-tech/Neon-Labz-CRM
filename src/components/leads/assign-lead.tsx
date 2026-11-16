"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { assignLeadAction } from "@/server/lead-actions";

/** Super Admin picks which salesperson owns a lead. */
export function AssignLead({ id, owner, sellers }: { id: string; owner: string; sellers: { username: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const options = sellers.some((s) => s.username === owner) ? sellers : [{ username: owner, label: owner }, ...sellers];
  return (
    <select
      defaultValue={owner}
      disabled={pending}
      aria-label={`Assign ${id}`}
      onChange={(event) => start(async () => { const result = await assignLeadAction(id, event.target.value); toast(result.ok, result.message); })}
      className="h-9 rounded-xl border border-line bg-white px-2 text-sm disabled:opacity-60"
    >
      {options.map((s) => <option key={s.username} value={s.username}>{s.label}</option>)}
    </select>
  );
}
