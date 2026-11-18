import { ProposalForm, type ProposalValues } from "@/components/reports/proposal-form";
import { ReportTable } from "@/components/reports/report-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { requireAction } from "@/lib/auth";
import { reportScope } from "@/lib/report-scope";
import { todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { isId, historyProjectCodes } from "@/lib/project-access";
import { reportProjects } from "@/lib/report-page";
import { deleteProposalAction } from "@/server/report-actions";
import { Proposal } from "@/models/report";

export const metadata = { title: "Reports · Proposals" };

const LISTS = ["stack", "brand", "packageStats", "budget"] as const;

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("reports.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const scope = reportScope(user, sp);
  const edit = scope.readOnly ? "" : param(sp, "edit");
  const adding = !scope.readOnly && param(sp, "new") === "1";
  // Reports of a project that is in History stay hidden until the project is moved back to active.
  const filter = { ...scope.owner, projectCode: { $nin: await historyProjectCodes() }, ...(q ? { title: new RegExp(escapeRegex(q), "i") } : {}) };

  const { projects, names } = await reportProjects(user);
  await connectDb();
  const [rows, total, editing] = await Promise.all([
    Proposal.find(filter).select("title projectCode date").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Proposal.countDocuments(filter),
    isId(edit) ? Proposal.findOne(user.role === "superadmin" ? { _id: edit } : { _id: edit, owner: user.username }).lean() : null,
  ]);

  // The editor works with plain text values and four row lists.
  const plain = editing ? (JSON.parse(JSON.stringify(editing)) as Record<string, unknown>) : null;
  const values: ProposalValues = { projectCode: "", date: todayISO() };
  const lists: Record<string, Record<string, string>[]> = {};
  if (plain) {
    for (const [key, value] of Object.entries(plain)) {
      if (typeof value === "string") values[key] = value;
      else if ((LISTS as readonly string[]).includes(key)) lists[key] = value as Record<string, string>[];
    }
    values.id = String(plain._id);
  }

  return (
    <>
      {!scope.readOnly && <div className="mb-4 flex justify-end"><AddLink href="?new=1">Add proposal</AddLink></div>}
      {(adding || editing) && (
        <Panel title={editing ? "Edit proposal" : "Add proposal"} closeHref="/reports/proposals">
          <ProposalForm key={values.id ?? "new"} projects={projects} values={values} lists={lists} />
        </Panel>
      )}
      <SearchBar q={q} keep={{ ...(scope.own && user.role === "superadmin" ? { own: "1" } : {}), ...(scope.pm ? { pm: scope.pm } : {}) }} placeholder="Search by title" />
      <ReportTable readOnly={scope.readOnly} pdfKind="proposal" rows={rows.map((r) => ({ id: String(r._id), title: r.title, projectCode: r.projectCode, date: r.date }))} projects={names} empty="No proposals yet" remove={{ action: deleteProposalAction, title: "Delete this proposal?" }} />
      <Pagination page={page} total={total} query={{ q, ...(scope.own && user.role === "superadmin" ? { own: "1" } : {}), ...(scope.pm ? { pm: scope.pm } : {}) }} />
    </>
  );
}
