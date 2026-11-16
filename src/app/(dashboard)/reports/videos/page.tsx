import { ReportTable } from "@/components/reports/report-table";
import { VideoForm } from "@/components/reports/forms";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { AddLink, Panel } from "@/components/ui/panel";
import { ReportsTop } from "@/components/projects/reports-top";
import { requireAction } from "@/lib/auth";
import { reportScope } from "@/lib/report-scope";
import { todayISO } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { isId } from "@/lib/project-access";
import { reportProjects } from "@/lib/report-page";
import { deleteVideoAction } from "@/server/report-actions";
import { DemoVideo } from "@/models/report";

export const metadata = { title: "Reports · Demo videos" };

export default async function VideosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("reports.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageOf(sp);
  const scope = reportScope(user, sp);
  const edit = scope.readOnly ? "" : param(sp, "edit");
  const adding = !scope.readOnly && param(sp, "new") === "1";
  const filter = { ...scope.owner, ...(q ? { title: new RegExp(escapeRegex(q), "i") } : {}) };

  const { projects, names } = await reportProjects(user);
  await connectDb();
  const [rows, total, editing] = await Promise.all([
    DemoVideo.find(filter).select("title projectCode date url").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    DemoVideo.countDocuments(filter),
    isId(edit) ? DemoVideo.findOne({ _id: edit, owner: user.username }).lean() : null,
  ]);

  return (
    <>
      {user.role === "superadmin" && <ReportsTop own={scope.own} pm={scope.pm} />}
      {!scope.readOnly && <div className="mb-4 flex justify-end"><AddLink href="?new=1">Add demo video</AddLink></div>}
      {(adding || editing) && (
        <Panel title={editing ? "Edit demo video" : "Add demo video"} closeHref="/reports/videos">
          <VideoForm projects={projects} values={editing
            ? { id: String(editing._id), projectCode: editing.projectCode, title: editing.title, date: editing.date, url: editing.url, notes: editing.notes }
            : { projectCode: "", title: "", date: todayISO(), url: "", notes: "" }} />
        </Panel>
      )}
      <SearchBar q={q} keep={{ ...(scope.own && user.role === "superadmin" ? { own: "1" } : {}), ...(scope.pm ? { pm: scope.pm } : {}) }} placeholder="Search by title" />
      <ReportTable readOnly={scope.readOnly} rows={rows.map((r) => ({ id: String(r._id), title: r.title, projectCode: r.projectCode, date: r.date, link: r.url || "" }))} projects={names} empty="No demo videos yet" remove={{ action: deleteVideoAction, title: "Delete this demo video?" }} />
      <Pagination page={page} total={total} query={{ q, ...(scope.own && user.role === "superadmin" ? { own: "1" } : {}), ...(scope.pm ? { pm: scope.pm } : {}) }} />
    </>
  );
}
