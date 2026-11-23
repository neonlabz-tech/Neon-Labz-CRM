"use client";

import { FilePlus, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { InfoForm } from "@/components/marketing/info-form";
import { ProposalForm } from "@/components/reports/proposal-form";
import { SrsForm } from "@/components/reports/forms";
import { ConfirmButton } from "@/components/ui/confirm";
import { DialogButton } from "@/components/ui/dialog-button";
import { SelectField } from "@/components/ui/field";
import { PdfLink } from "@/components/ui/pdf-link";
import { clearSpecialInfoAction, deleteSpecialClientAction, deleteSpecialDocAction, saveSpecialInfoAction, saveSpecialProposalAction, saveSpecialSrsAction } from "@/server/special-actions";
import { ClientForm, QuoteForm, type ClientDefaults, type ClientOption, type QuoteDefaults } from "./forms";

type PackageOption = { id: string; name: string; price: number; scope: string; fullScope: string; hasSummary: boolean };
type Row = Record<string, string>;

const trigger = (label: string) => (
  <span className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm hover:brightness-110"><Plus className="h-4 w-4" />{label}</span>
);
const edit = <Pencil className="h-4 w-4" />;
const bin = <Trash2 className="h-4 w-4" />;

/** The "who is it for" choice that stands in for the project choice of the project-report forms. */
function ClientPick({ clients, value }: { clients: ClientOption[]; value: string }) {
  return (
    <SelectField label="Client" required name="clientId" defaultValue={value}>
      <option value="" disabled>Choose a client</option>
      {clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.code}</option>)}
    </SelectField>
  );
}

/* ---------- Clients ---------- */

export function AddClientButton() {
  return (
    <DialogButton label="Add client" title="Add special client" subtitle="An influencer, a school or any client you handle directly" headerIcon={<UserPlus className="h-5 w-5" />} trigger={trigger("Add client")}>
      <ClientForm />
    </DialogButton>
  );
}

export function ClientActions({ client }: { client: ClientDefaults & { id: string } }) {
  return (
    <div className="flex gap-2">
      <DialogButton label="Edit" title="Edit client" subtitle={client.name} icon={edit} headerIcon={edit}><ClientForm defaults={client} /></DialogButton>
      <ConfirmButton icon={bin} label="Delete" title="Delete this client?" text="Its quotations, proposals, SRS documents and info are deleted with it. This cannot be undone." confirmLabel="Delete" run={() => deleteSpecialClientAction(client.id)} />
    </div>
  );
}

/* ---------- Client info (the marketing client-info form) ---------- */

type Social = Record<string, { username: string; pageLink: string; hasPassword: boolean }>;

export function AddInfoButton({ clients }: { clients: ClientOption[] }) {
  return (
    <DialogButton label="Add client info" title="Add client info" subtitle="Brand details and social accounts" headerIcon={<Plus className="h-5 w-5" />} wide trigger={trigger("Add client info")}>
      <InfoForm clients={clients.map((c) => ({ code: c.id, name: c.name, label: `${c.name} · ${c.code}` }))} clientCode="" lockClient={false} values={{}} social={{}} action={saveSpecialInfoAction} showLogo={false} />
    </DialogButton>
  );
}

export function InfoActions({ id, name, values, social }: { id: string; name: string; values: Row; social: Social }) {
  return (
    <div className="flex gap-2">
      <PdfLink kind="spinfo" id={id} />
      <DialogButton label="Edit" title="Edit client info" subtitle={name} icon={edit} headerIcon={edit} wide>
        <InfoForm clients={[{ code: id, name }]} clientCode={id} lockClient values={values} social={social} action={saveSpecialInfoAction} showLogo={false} />
      </DialogButton>
      <ConfirmButton icon={bin} label="Remove info" title="Remove this client info?" text="The brand details and social accounts of this client are cleared. The client and its documents stay." confirmLabel="Remove" run={() => clearSpecialInfoAction(id)} />
    </div>
  );
}

/* ---------- Quotations ---------- */

export function AddQuoteButton({ clients, packages, defaults }: { clients: ClientOption[]; packages: PackageOption[]; defaults: QuoteDefaults }) {
  return (
    <DialogButton label="New quotation" title="New quotation" subtitle="For a special client" headerIcon={<FilePlus className="h-5 w-5" />} wide trigger={trigger("New quotation")}>
      <QuoteForm clients={clients} packages={packages} defaults={defaults} />
    </DialogButton>
  );
}

export function QuoteActions({ id, number, clients, packages, defaults }: { id: string; number: string; clients: ClientOption[]; packages: PackageOption[]; defaults: QuoteDefaults }) {
  return (
    <div className="flex gap-2">
      <PdfLink kind="spquote" id={id} />
      <DialogButton label="Edit" title="Edit quotation" subtitle={number} icon={edit} headerIcon={edit} wide><QuoteForm clients={clients} packages={packages} defaults={{ ...defaults, id }} /></DialogButton>
      <ConfirmButton icon={bin} label="Delete" title="Delete this quotation?" text={`${number} is deleted. This cannot be undone.`} confirmLabel="Delete" run={() => deleteSpecialDocAction(id)} />
    </div>
  );
}

/* ---------- Proposals (the project-report proposal form) ---------- */

type ProposalLists = { stack?: Row[]; brand?: Row[]; packageStats?: Row[]; budget?: Row[] };

export function AddProposalButton({ clients, today }: { clients: ClientOption[]; today: string }) {
  return (
    <DialogButton label="New proposal" title="New proposal" subtitle="For a special client" headerIcon={<FilePlus className="h-5 w-5" />} wide trigger={trigger("New proposal")}>
      <ProposalForm values={{ date: today }} lists={{}} action={saveSpecialProposalAction} picker={<ClientPick clients={clients} value="" />} />
    </DialogButton>
  );
}

export function ProposalActions({ id, number, clientId, clients, values, lists }: { id: string; number: string; clientId: string; clients: ClientOption[]; values: Row; lists: ProposalLists }) {
  return (
    <div className="flex gap-2">
      <PdfLink kind="spdoc" id={id} />
      <DialogButton label="Edit" title="Edit proposal" subtitle={number} icon={edit} headerIcon={edit} wide>
        <ProposalForm values={{ ...values, id }} lists={lists} action={saveSpecialProposalAction} picker={<ClientPick clients={clients} value={clientId} />} />
      </DialogButton>
      <ConfirmButton icon={bin} label="Delete" title="Delete this proposal?" text={`${number} is deleted. This cannot be undone.`} confirmLabel="Delete" run={() => deleteSpecialDocAction(id)} />
    </div>
  );
}

/* ---------- SRS documents (the project-report SRS form) ---------- */

const srsValues = (values: Row, extra: Row) => ({ projectCode: "", title: "", preparedFor: "", date: "", introduction: "", functional: "", nonFunctional: "", assumptions: "", ...values, ...extra });

export function AddSrsButton({ clients, today }: { clients: ClientOption[]; today: string }) {
  return (
    <DialogButton label="New SRS document" title="New SRS document" subtitle="For a special client" headerIcon={<FilePlus className="h-5 w-5" />} wide trigger={trigger("New SRS document")}>
      <SrsForm values={srsValues({}, { date: today })} action={saveSpecialSrsAction} picker={<ClientPick clients={clients} value="" />} />
    </DialogButton>
  );
}

export function SrsActions({ id, number, clientId, clients, values }: { id: string; number: string; clientId: string; clients: ClientOption[]; values: Row }) {
  return (
    <div className="flex gap-2">
      <PdfLink kind="spdoc" id={id} />
      <DialogButton label="Edit" title="Edit SRS document" subtitle={number} icon={edit} headerIcon={edit} wide>
        <SrsForm values={{ ...srsValues(values, {}), id }} action={saveSpecialSrsAction} picker={<ClientPick clients={clients} value={clientId} />} />
      </DialogButton>
      <ConfirmButton icon={bin} label="Delete" title="Delete this SRS document?" text={`${number} is deleted. This cannot be undone.`} confirmLabel="Delete" run={() => deleteSpecialDocAction(id)} />
    </div>
  );
}
