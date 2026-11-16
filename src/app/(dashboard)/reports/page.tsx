import { ReportTable } from "@/components/reports/report-table";
import { SrsForm } from "@/components/reports/forms";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { ReportsTop } from "@/components/projects/reports-top";
import { requireAction } from "@/lib/auth";
import { reportScope } from "@/lib/report-scope";
import { todayISO } from "@/lib/dates";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { isId } from "@/lib/project-access";
import { reportProjects } from "@/lib/report-page";
import { deleteSrsAction } from "@/server/report-actions";
import { Srs } from "@/models/report";

export const metadata = { title: "Reports · SRS" };

export default async function SrsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("reports.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const scope = reportScope(user, sp);
  const edit = scope.readOnly ? "" : param(sp, "edit");
  const adding = !scope.readOnly && param(sp, "new") === "1";
  const filter = { ...scope.owner, ...(q ? { title: new RegExp(escapeRegex(q), "i") } : {}) };

  const { projects, names } = await reportProjects(user);
  const [rows, total, editing] = await Promise.all([
    Srs.find(filter).select("title projectCode date").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Srs.countDocuments(filter),
    isId(edit) ? Srs.findOne({ _id: edit, owner: user.username }).lean() : null,
  ]);

  return (
    <>
      {user.role === "superadmin" && <ReportsTop own={scope.own} pm={scope.pm} />}
      {!scope.readOnly && <div className="mb-4 flex justify-end"><AddLink href="?new=1">Add SRS document</AddLink></div>}
      {(adding || editing) && (
        <Panel title={editing ? "Edit SRS document" : "Add SRS document"} closeHref="/reports">
          <SrsForm projects={projects} values={editing
            ? { id: String(editing._id), projectCode: editing.projectCode, title: editing.title, preparedFor: editing.preparedFor, date: editing.date, introduction: editing.introduction, functional: editing.functional, nonFunctional: editing.nonFunctional, assumptions: editing.assumptions }
            : { projectCode: "", title: "", preparedFor: "", date: todayISO(), introduction: "", functional: "", nonFunctional: "", assumptions: "" }} />
        </Panel>
      )}
      <SearchBar q={q} keep={{ ...(scope.own && user.role === "superadmin" ? { own: "1" } : {}), ...(scope.pm ? { pm: scope.pm } : {}) }} placeholder="Search by title" />
      <ReportTable readOnly={scope.readOnly} pdfKind="srs" rows={rows.map((r) => ({ id: String(r._id), title: r.title, projectCode: r.projectCode, date: r.date }))} projects={names} empty="No SRS documents yet" remove={{ action: deleteSrsAction, title: "Delete this SRS document?" }} />
      <Pagination page={page} total={total} query={{ q, ...(scope.own && user.role === "superadmin" ? { own: "1" } : {}), ...(scope.pm ? { pm: scope.pm } : {}) }} />
    </>
  );
}
