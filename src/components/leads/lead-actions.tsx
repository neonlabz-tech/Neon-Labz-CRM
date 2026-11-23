"use client";

import { FileText, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { IconLink } from "@/components/ui/icon-link";
import { deleteLeadAction } from "@/server/lead-actions";

/** The icons at the end of a lead row. `children` is the follow-up window, shown first; the lead itself opens from its ID. */
export function LeadRowActions({ id, canDelete, canQuote = false, children }: { id: string; canDelete: boolean; canQuote?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      {children}
      {canQuote && <IconLink href={`/quotations/${id}`} label="Quotation"><FileText /></IconLink>}
      {canDelete && <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title={`Delete ${id}?`} text="This removes the lead and its call history. If it has a quotation, that quotation and its saved PDF are removed too. Leads with payment or receipt records are kept." confirmLabel="Delete" run={() => deleteLeadAction(id)} />}
    </div>
  );
}
