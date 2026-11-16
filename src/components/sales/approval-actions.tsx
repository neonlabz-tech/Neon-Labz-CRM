"use client";

import { Check, X } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { approveInvoiceAction, cancelPaymentAction } from "@/server/approval-actions";

export function ApprovalActions({ id, client }: { id: string; client: string }) {
  return (
    <div className="flex flex-wrap gap-2 md:flex-nowrap">
      <ConfirmButton variant="primary" icon={<Check className="h-4 w-4" />} label="Approve" title="Approve this payment?" text={`${client} will become a client and the team that does the work will be told.`} confirmLabel="Approve" run={() => approveInvoiceAction(id)} />
      <ConfirmButton icon={<X className="h-4 w-4" />} label="Reject" title="Reject this payment?" text="The receipt is removed and the sales person is told. They can submit it again." confirmLabel="Reject" run={() => cancelPaymentAction(id)} />
    </div>
  );
}
