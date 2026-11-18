import { Badge } from "@/components/ui/badge";
import { PmSelect } from "@/components/projects/pm-select";

/** Super Admin's strip above the project tabs: who is being viewed and whether it can be changed. */
export function AccessBar({ own, pm, path, accounts, name = "pm", noun = "project", editable = own }: { own: boolean; editable?: boolean; pm: string; path: string; accounts: { username: string; label: string }[]; name?: string; noun?: string }) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {own ? <span /> : <PmSelect value={pm} options={accounts} path={path} name={name} />}
        <Badge tone={editable ? "success" : "warning"}>{editable ? "Full access" : "Overview only"}</Badge>
      </div>
      {!editable && <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">{noun[0]!.toUpperCase() + noun.slice(1)} records are view only from this account.</p>}
    </div>
  );
}
