import { GoesToField } from "@/components/sales/goes-to-field";
import { Field } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { MultiSuggestField, SuggestField } from "@/components/ui/suggest";
import { UNASSIGNED } from "@/models/manual-sale-values";
import { saveManualSaleAction } from "@/server/manual-sale-actions";

/**
 * An existing client (an old project) the Super Admin brings in. It saves as a confirmed manual sale of no value,
 * so the client, the "Goes to" rules and the notifications all work the same way as for any manual sale.
 */
export function GuestForm({ today, clients, services, categories }: { today: string; clients: string[]; services: string[]; categories: Record<string, string> }) {
  return (
    <ActionForm action={saveManualSaleAction} submit="Add guest" className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="guest" value="1" />
      <input type="hidden" name="owner" value={UNASSIGNED} />
      <input type="hidden" name="amount" value="0" />
      <input type="hidden" name="collected" value="0" />
      <input type="hidden" name="status" value="confirmed" />
      <SuggestField label="Client" required name="business" options={clients} placeholder="Type a client name" maxLength={160} />
      <Field label="Old project date" required name="date" type="date" defaultValue={today} max={today} />
      <MultiSuggestField label="Service or package" required name="service" options={services} placeholder="Type to find a package, or write your own" />
      <GoesToField defaultValue="project" defaultOwner={UNASSIGNED} categories={categories} />
      <p className="text-xs text-muted sm:col-span-2">Use this for a client who already has a running project. It does not count as a lead or as revenue. After saving, open Clients and start the project; dates in the past are allowed for a guest.</p>
    </ActionForm>
  );
}
