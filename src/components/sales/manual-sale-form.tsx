import { GoesToField } from "@/components/sales/goes-to-field";
import { Field, SelectField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { MultiSuggestField, SuggestField } from "@/components/ui/suggest";
import { MANUAL_SALE_STATUSES, UNASSIGNED } from "@/models/manual-sale";
import { saveManualSaleAction } from "@/server/manual-sale-actions";

const LABEL = { pending: "Pending", confirmed: "Confirmed", rejected: "Rejected" } as const;

export function ManualSaleForm({ values, people, clients, services, categories, paymentsLocked = false }: {
  clients: string[]; services: string[];
  /** Package name (lower case) to its category, so "Goes to" can fill itself. */
  categories: Record<string, string>;
  values: { id?: string; business: string; date: string; service: string; owner: string; amount: string; collected: string; status: string; goesTo: string };
  /** True once receipts exist: the collected total then only changes through &ldquo;Add payment&rdquo;. */
  paymentsLocked?: boolean;
  people: { username: string; name: string }[];
}) {
  return (
    <ActionForm action={saveManualSaleAction} submit="Save sale" toastOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <SuggestField label="Client" required name="business" options={clients} placeholder="Type a client name" defaultValue={values.business} maxLength={160} />
      <Field label="Sale date" required name="date" type="date" defaultValue={values.date} />
      <MultiSuggestField label="Service or package" required name="service" options={services} placeholder="Type to find a package, or write your own" defaultValue={values.service} />
      <SelectField label="Salesperson" required name="owner" defaultValue={values.owner}>
        <option value="" disabled>Choose a salesperson</option>
        <option value={UNASSIGNED}>Unassigned (no salesperson)</option>
        {people.map((p) => <option key={p.username} value={p.username}>{p.name === p.username ? p.username : `${p.username} · ${p.name}`}</option>)}
      </SelectField>
      <Field label="Sale value (LKR)" required name="amount" type="number" min="0" step="0.01" defaultValue={values.amount} />
      <Field label="Collected so far (LKR)" required name="collected" type="number" min="0" step="0.01" defaultValue={values.collected} disabled={paymentsLocked} />
      <GoesToField defaultValue={values.goesTo} defaultOwner={values.owner} categories={categories} />
      <SelectField label="Status" required name="status" defaultValue={values.status}>
        {MANUAL_SALE_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
      </SelectField>
      <p className="text-xs text-muted sm:col-span-2">When the sale is confirmed, anything collected so far becomes its first receipt. Later payments are added from the sale list with &ldquo;Add payment&rdquo; and each gets its own receipt.</p>
    </ActionForm>
  );
}
