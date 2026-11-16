"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setTeamAction } from "@/server/project-actions";

type Props = { code: string; lane: "software" | "marketing"; title: string; employees: { username: string; label: string }[]; team: string[]; editable: boolean };

export function TeamForm({ code, lane, title, employees, team, editable }: Props) {
  const [picked, setPicked] = useState(team);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {employees.length === 0 ? <p className="text-sm text-muted">No employee logins yet.</p> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {employees.map((e) => (
            <label key={e.username} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <input
                type="checkbox"
                disabled={!editable}
                checked={picked.includes(e.username)}
                onChange={(event) => setPicked((list) => (event.target.checked ? [...list, e.username] : list.filter((u) => u !== e.username)))}
              />{e.label}
            </label>
          ))}
        </div>
      )}
      {editable && (
        <Button size="sm" className="mt-3" disabled={pending} onClick={() => start(async () => { const r = await setTeamAction(code, lane, picked); toast(r.ok, r.message); })}>Save team</Button>
      )}
    </div>
  );
}
