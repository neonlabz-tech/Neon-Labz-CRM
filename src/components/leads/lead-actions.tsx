"use client";

import { FileText, Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { IconLink } from "@/components/ui/icon-link";
import { deleteLeadAction } from "@/server/lead-actions";

export function LeadRowActions({ id, canDelete, canQuote = false }: { id: string; canDelete: boolean; canQuote?: boolean }) {
  return (
    <div className="flex gap-2">
      <IconLink href={`/leads/${id}`} label="Open"><Pencil /></IconLink>
      {canQuote && <IconLink href={`/quotations/${id}`} label="Quotation"><FileText /></IconLink>}
      {canDelete && <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title={`Delete ${id}?`} text="This removes the lead and its call history. It cannot be undone." confirmLabel="Delete" run={() => deleteLeadAction(id)} />}
    </div>
  );
}
