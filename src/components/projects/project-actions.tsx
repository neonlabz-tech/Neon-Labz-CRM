"use client";

import { History, Undo2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { archiveProjectAction } from "@/server/project-actions";

/** Moves a project into History (or back to the active list). Nothing is deleted. `archived` means "in History". */
export function ArchiveProject({ code, archived }: { code: string; archived: boolean }) {
  return (
    <ConfirmButton
      variant="outline"
      icon={archived ? <Undo2 className="h-4 w-4" /> : <History className="h-4 w-4" />}
      label={archived ? "Move back to active" : "Move to history"}
      title={archived ? "Move this project back to active?" : "Move this project to history?"}
      text={archived ? "It will show in the Projects list again and employees will see it." : "It leaves the Projects list and employees will no longer see it. Nothing is deleted. You can move it back any time from History."}
      confirmLabel={archived ? "Move back" : "Move to history"}
      run={() => archiveProjectAction(code, !archived)}
    />
  );
}
