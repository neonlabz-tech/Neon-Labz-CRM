"use client";

import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { deleteQuotationAction } from "@/server/quotation-actions";

export function QuotationDeleteButton({ id, number }: { id: string; number: string }) {
  return (
    <ConfirmButton
      icon={<Trash2 className="h-4 w-4" />}
      label="Delete quotation"
      title={`Delete quotation ${number}?`}
      text="This removes the quotation and its saved PDF. Quotations with payment or receipt records cannot be deleted."
      confirmLabel="Delete"
      run={() => deleteQuotationAction(id)}
    />
  );
}
