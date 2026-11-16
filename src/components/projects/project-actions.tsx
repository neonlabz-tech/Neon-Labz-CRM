"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { archiveProjectAction } from "@/server/project-actions";

export function ArchiveProject({ code, archived }: { code: string; archived: boolean }) {
  return (
    <ConfirmButton
      variant="outline"
      icon={archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
      label={archived ? "Restore" : "Archive"}
      title={archived ? "Restore this project?" : "Archive this project?"}
      text={archived ? "Employees will see it again." : "Employees will no longer see it. You can restore it later."}
      confirmLabel={archived ? "Restore" : "Archive"}
      run={() => archiveProjectAction(code, !archived)}
    />
  );
}
