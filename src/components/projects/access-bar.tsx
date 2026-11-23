import { Badge } from "@/components/ui/badge";
import { PmSelect } from "@/components/projects/pm-select";

/** Super Admin's strip above the project tabs: who is being viewed and whether it can be changed. */
export function AccessBar({ own, pm, path, accounts, name = "pm", noun = "project", editable = own }: { own: boolean; editable?: boolean; pm: string; path: string; accounts: { username: string; label: string }[]; name?: string; noun?: string }) {
  // Inside the PM or MD area only that team's accounts are offered.
  const team = pm === "PM" || pm.startsWith("PM_") ? "PM" : pm === "MD" || pm.startsWith("MD_") ? "MD" : "";
  const shown = team ? accounts.filter((a) => a.username.startsWith(`${team}_`)) : accounts;
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {own ? <span /> : <PmSelect value={pm} options={shown} path={path} name={name} allValue={team} allLabel={team ? `All ${team} accounts` : "All accounts"} />}
        <Badge tone={editable ? "success" : "warning"}>{editable ? "Full access" : "Overview only"}</Badge>
      </div>
      {!editable && <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">{noun[0]!.toUpperCase() + noun.slice(1)} records are view only from this account.</p>}
    </div>
  );
}
