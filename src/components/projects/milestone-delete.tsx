"use client";

import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { deleteMilestoneAction } from "@/server/project-actions";

export function MilestoneDelete({ code, id, title }: { code: string; id: string; title: string }) {
  return <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title={`Delete “${title}”?`} text="Its tasks are deleted too. This cannot be undone." confirmLabel="Delete" run={() => deleteMilestoneAction(code, id)} />;
}
