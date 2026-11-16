"use client";

import { Pencil, Trash2 } from "lucide-react";
import { PdfLink } from "@/components/ui/pdf-link";
import { ConfirmButton } from "@/components/ui/confirm";
import { IconLink } from "@/components/ui/icon-link";
import { deleteInfoAction, deletePlanAction, deleteReportAction } from "@/server/marketing-actions";


export function InfoRowActions({ clientCode, readOnly = false }: { clientCode: string; readOnly?: boolean }) {
  if (readOnly) return <PdfLink kind="info" id={clientCode} />;
  return (
    <div className="flex gap-2">
      <PdfLink kind="info" id={clientCode} />
      <IconLink href={`/marketing/info/${clientCode}`} label="Open"><Pencil /></IconLink>
      <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title="Delete this info document?" text="Saved logins for this client are removed too." confirmLabel="Delete" run={() => deleteInfoAction(clientCode)} />
    </div>
  );
}

export function PlanRowActions({ id }: { id: string }) {
  return (
    <div className="flex gap-2">
      <PdfLink kind="plan" id={id} />
      <IconLink href={`/marketing/plans/${id}`} label="Open"><Pencil /></IconLink>
      <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title="Delete this plan?" text="This cannot be undone." confirmLabel="Delete" run={() => deletePlanAction(id)} />
    </div>
  );
}

export function ReportRowActions({ id }: { id: string }) {
  return (
    <div className="flex gap-2">
      <PdfLink kind="report" id={id} />
      <IconLink href={`/marketing/reports/${id}`} label="Open"><Pencil /></IconLink>
      <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title="Delete this report?" text="Its uploaded images are removed too." confirmLabel="Delete" run={() => deleteReportAction(id)} />
    </div>
  );
}
