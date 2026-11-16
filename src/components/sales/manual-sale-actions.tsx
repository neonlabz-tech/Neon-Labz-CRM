"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { IconLink } from "@/components/ui/icon-link";
import { deleteManualSaleAction, setManualSaleStatusAction } from "@/server/manual-sale-actions";

/** `locked` is true once receipts exist: such a sale stays confirmed and cannot be deleted. */
export function ManualSaleActions({ id, status, editHref, locked = false }: { id: string; status: string; editHref: string; locked?: boolean }) {
  return (
    <div className="flex gap-2">
      <IconLink href={editHref} label="Review or edit"><Pencil /></IconLink>
      {status !== "confirmed" && <ConfirmButton variant="primary" icon={<Check className="h-4 w-4" />} label="Confirm" title="Confirm this sale?" text="It counts as a confirmed sale, the client becomes a paying client and the team that will do the work is told." confirmLabel="Confirm" run={() => setManualSaleStatusAction(id, "confirmed")} />}
      {status !== "rejected" && !locked && <ConfirmButton icon={<X className="h-4 w-4" />} label="Reject" title="Reject this sale?" text="It will stay on the list as rejected and will not count." confirmLabel="Reject" run={() => setManualSaleStatusAction(id, "rejected")} />}
      {!locked && <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title="Delete this sale?" text="This cannot be undone." confirmLabel="Delete" run={() => deleteManualSaleAction(id)} />}
    </div>
  );
}
