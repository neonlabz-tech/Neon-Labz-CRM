import { EmptyState } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PdfLink } from "@/components/ui/pdf-link";
import { RowActions } from "@/components/ui/row-actions";
import type { ActionState } from "@/types";

export type ReportRow = { id: string; title: string; projectCode: string; date: string; link?: string };

export function ReportTable({ rows, projects, empty, remove, pdfKind, readOnly = false }: {
  readOnly?: boolean; pdfKind?: "srs" | "proposal"; rows: ReportRow[]; projects: Map<string, string>; empty: string;
  remove: { action: (id: string) => Promise<ActionState>; title: string };
}) {
  if (rows.length === 0) return <EmptyState title={empty} text="Add one to see it here." />;
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      columns={[
        { header: "Title", cell: (r) => r.title },
        { header: "Project", cell: (r) => projects.get(r.projectCode) ?? "Project removed" },
        { header: "Date", cell: (r) => r.date || "—" },
        ...(rows.some((r) => r.link) ? [{ header: "Link", cell: (r: ReportRow) => (r.link ? <a href={r.link} target="_blank" rel="noreferrer" className="break-all text-brand-700 underline">{r.link}</a> : "No link yet.") }] : []),
        { header: "Actions", cell: (r) => (
          <div className="flex gap-2">
            {pdfKind && <PdfLink kind={pdfKind} id={r.id} />}
            {!readOnly && <RowActions id={r.id} editHref={`?edit=${r.id}`} remove={{ action: remove.action, title: remove.title, text: "This cannot be undone." }} />}
          </div>
        ) },
      ]}
    />
  );
}
