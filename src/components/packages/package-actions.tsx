"use client";

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { IconLink } from "@/components/ui/icon-link";
import { deletePackageAction, setPackageStatusAction } from "@/server/package-actions";

export function PackageRowActions({ id, status }: { id: string; status: "active" | "archived" }) {
  return (
    <div className="flex gap-2">
      <IconLink href={`/packages/${id}`} label="Edit"><Pencil /></IconLink>
      <ConfirmButton
        variant="outline"
        icon={status === "active" ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
        label={status === "active" ? "Archive" : "Restore"}
        title={status === "active" ? "Archive this package?" : "Restore this package?"}
        text={status === "active" ? "It will no longer be offered on new quotations. Old quotations are not changed." : "It will be offered on new quotations again."}
        confirmLabel={status === "active" ? "Archive" : "Restore"}
        run={() => setPackageStatusAction(id, status === "active" ? "archived" : "active")}
      />
      <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title="Delete this package?" text="This cannot be undone. Old quotations keep their own copy of the package." confirmLabel="Delete" run={() => deletePackageAction(id)} />
    </div>
  );
}
