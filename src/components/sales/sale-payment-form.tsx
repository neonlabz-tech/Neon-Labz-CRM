"use client";

import { Plus } from "lucide-react";
import { DialogButton } from "@/components/ui/dialog-button";
import { Field } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { addSalePaymentAction } from "@/server/manual-sale-actions";

/** "Add payment" on a confirmed sale: opens a window asking for the amount, date and how it was paid. */
export function SalePaymentButton({ id, code, balance, today }: { id: string; code: string; balance: number; today: string }) {
  return (
    <DialogButton label="Add payment" title="Add payment" subtitle={`${code} · balance LKR ${balance.toLocaleString("en-LK", { maximumFractionDigits: 2 })}`} icon={<Plus />} variant="primary">
      <ActionForm action={addSalePaymentAction} submit="Save payment" className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={id} />
        <Field label="Amount received (LKR)" required name="amount" type="number" min="0" max={balance} step="0.01" defaultValue={balance} />
        <Field label="Payment date" required name="date" type="date" defaultValue={today} max={today} />
        <Field label="Payment method" required name="method" placeholder="Bank transfer, cash, card" maxLength={60} />
        <Field label="Reference no." required name="transactionId" maxLength={80} />
      </ActionForm>
    </DialogButton>
  );
}
