import { FileField } from "@/components/ui/file-field";
import { Field, SelectField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { PAYMENT_TYPES } from "@/models/payment";
import { submitPaymentAction } from "@/server/payment-actions";

export type PayableClient = { leadId: string; label: string };

export function PaymentForm({ clients, today, own = false }: { clients: PayableClient[]; today: string; own?: boolean }) {
  return (
    <ActionForm action={submitPaymentAction} submit={own ? "Save payment" : "Send for approval"} toastOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <SelectField label="Client" required name="leadId" defaultValue="">
          <option value="" disabled>Choose a client with a saved quotation</option>
          {clients.map((c) => <option key={c.leadId} value={c.leadId}>{c.label}</option>)}
        </SelectField>
      </div>
      <Field label="Amount received (LKR)" name="amount" type="number" min="0" step="0.01" required />
      <Field label="Payment date" name="date" type="date" defaultValue={today} required />
      <SelectField label="Payment type" required name="type" defaultValue={PAYMENT_TYPES[0]}>
        {PAYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
      </SelectField>
      <Field label="Payment method" name="method" placeholder="Bank transfer, cash, card" required />
      <Field label="Transaction or reference no." name="transactionId" />
      <div className="sm:col-span-2"><FileField label="Receipt or slip" name="proof" accept="image/jpeg,image/png,image/webp,application/pdf" hint="Image or PDF · up to 5 MB · needed unless you enter a reference no." maxMb={5} /></div>
    </ActionForm>
  );
}
