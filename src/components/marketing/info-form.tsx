import { Field, SelectField } from "@/components/ui/field";
import { LogoField } from "@/components/clients/contacts-form";
import { ActionForm } from "@/components/ui/form";
import { INFO_FIELDS, SOCIALS, SOCIAL_LABEL } from "@/lib/marketing";
import { saveInfoAction } from "@/server/marketing-actions";
import { PasswordField } from "@/components/auth/password-field";
import type { ActionState } from "@/types";

type InfoValues = Record<string, string>;
type Props = {
  clients: { code: string; name: string; label?: string }[]; clientCode: string; lockClient: boolean;
  values: InfoValues; social: Record<string, { username: string; pageLink: string; hasPassword: boolean }>;
  /** The client's current logo, when there is one. */
  logo?: string;
  /** Another area (Special Clients) can use the same form with its own save and without the client logo. */
  action?: (state: ActionState, data: FormData) => Promise<ActionState>;
  showLogo?: boolean;
};

export function InfoForm({ clients, clientCode, lockClient, values, social, logo = "", action = saveInfoAction, showLogo = true }: Props) {
  return (
    <ActionForm action={action} submit="Save client info" toastOnSuccess={false} className="space-y-6">
      {lockClient ? (
        <>
          <input type="hidden" name="clientCode" value={clientCode} />
          <p className="text-sm text-muted">Client: <strong className="text-ink">{clients.find((c) => c.code === clientCode)?.name ?? clientCode}</strong></p>
        </>
      ) : (
        <SelectField label="Client" required name="clientCode" defaultValue={clientCode}>
          <option value="" disabled>{showLogo ? "Choose a paying client" : "Choose a client"}</option>
          {clients.map((c) => <option key={c.code} value={c.code}>{c.label ?? `${c.name} (${c.code})`}</option>)}
        </SelectField>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {INFO_FIELDS.map(([key, label]) => <Field key={key} label={label} required={key === "brandName" || key === "mainContactName"} name={key} defaultValue={values[key]} type={key === "email" ? "email" : "text"} />)}
      </div>
      {showLogo && (
        <div>
          <LogoField logo={logo} name={clients.find((c) => c.code === clientCode)?.name ?? "Client"} />
          <p className="mt-1 text-xs text-muted">Optional. The logo is saved on the client, so it also shows on the Clients page and in the marketing report.</p>
        </div>
      )}
      <div>
        <h2 className="mb-1 font-semibold">Social accounts</h2>
        <p className="mb-3 text-xs text-muted">Passwords are saved encrypted. Leave a password blank to keep the one already saved.</p>
        <div className="space-y-3">
          {SOCIALS.map((key) => (
            <div key={key} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-3">
              <Field label={`${SOCIAL_LABEL[key]} username`} name={`social_${key}_username`} defaultValue={social[key]?.username} autoComplete="off" />
              <PasswordField label={social[key]?.hasPassword ? "Password (saved)" : "Password"} name={`social_${key}_password`} autoComplete="new-password" />
              <Field label="Page link" name={`social_${key}_pageLink`} defaultValue={social[key]?.pageLink} />
            </div>
          ))}
        </div>
      </div>
    </ActionForm>
  );
}
