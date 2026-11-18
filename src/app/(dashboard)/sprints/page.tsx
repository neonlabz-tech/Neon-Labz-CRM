import { Eye } from "lucide-react";
import { AccessBar } from "@/components/projects/access-bar";
import { MeetingForm } from "@/components/projects/meeting-form";
import { AUDIENCE_SHORT, sentToFilter } from "@/lib/audience";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/list-controls";
import { IconLink } from "@/components/ui/icon-link";
import { AddLink, Panel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { MEETING_STATUS, RECURRENCES, pastMeetings, upcomingMeetings } from "@/lib/meetings";
import { keepOwn, ownView } from "@/lib/own";
import { pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { accountFilter, isId, visibleProjectFilter } from "@/lib/project-access";
import { reportProjects } from "@/lib/report-page";
import { formatClock, formatDay } from "@/lib/utils";
import { deleteMeetingAction } from "@/server/meeting-actions";
import { Meeting } from "@/models/meeting";
import { Project } from "@/models/project";
import { User } from "@/models/user";

export const metadata = { title: "Sprints" };

const TYPE = { software: "Software project", marketing: "Marketing project", both: "Both" } as const;
const tone = (status: string) => (status === "conducted" ? "success" : status === "cancelled" ? "danger" : "info");

export default async function SprintsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("projects.view");
  const sp = await searchParams;
  const own = ownView(user.role, sp);
  const pm = param(sp, "pm");
  const page = pageOf(sp);
  const manage = can(user.role, "projects.manage");
  const adding = manage && param(sp, "new") === "1";
  const edit = manage ? param(sp, "edit") : "";
  const view = param(sp, "view");

  await connectDb();
  const visible = await Project.find({ $and: [{ archived: false }, await visibleProjectFilter(user), ...(own ? [{ owner: user.username }] : []), ...(pm ? [accountFilter(pm)] : [])] }).select("code name type").lean();
  const projects = new Map(visible.map((p) => [p.code, p]));
  const filter = { projectCode: { $in: [...projects.keys()] }, ...sentToFilter(user.role) };
  const [rows, total, { projects: choices }, accounts] = await Promise.all([
    Meeting.find(filter).sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Meeting.countDocuments(filter),
    reportProjects(user),
    user.role === "superadmin" && !own ? User.find({ role: { $in: ["pm", "marketing"] } }).select("username fullName").sort({ username: 1 }).lean() : [],
  ]);
  const editing = isId(edit) ? rows.find((r) => String(r._id) === edit) : undefined;
  const viewing = isId(view) ? rows.find((r) => String(r._id) === view) : undefined;
  const keep = keepOwn(own);
  const base = `/sprints${own ? "?own=1" : pm ? `?pm=${encodeURIComponent(pm)}` : ""}`;
  const withParam = (extra: string) => `/sprints?${extra}${own ? "&own=1" : ""}${pm ? `&pm=${encodeURIComponent(pm)}` : ""}`;

  return (
    <>
      <PageHeader title="Sprints" subtitle="Each row is a project meeting. Repeating meetings move to the next date after one is marked conducted or cancelled.">
        {manage && <AddLink href={withParam("new=1")}>Schedule meeting</AddLink>}
      </PageHeader>
      {user.role === "superadmin" && <AccessBar own={own} editable pm={pm} path="/sprints" accounts={accounts.map((a) => ({ username: a.username, label: a.fullName ? `${a.fullName} (${a.username})` : a.username }))} />}
      {(adding || editing) && (
        <Panel title={editing ? "Edit meeting" : "Schedule meeting"} closeHref={base}>
          <MeetingForm showAudience={user.role === "superadmin"} projects={choices} values={editing
            ? { id: String(editing._id), projectCode: editing.projectCode, startDate: editing.startDate, time: editing.time, link: editing.link, recurrence: editing.recurrence, audience: editing.audience, status: "scheduled", nextDate: formatDay(upcomingMeetings(editing)[0]?.date ?? editing.startDate) }
            : { projectCode: "", startDate: "", time: "09:00", link: "", recurrence: "none" }} />
        </Panel>
      )}
      {viewing && (
        <Panel title={`Meeting history · ${projects.get(viewing.projectCode)?.name ?? "Project removed"}`} closeHref={base}>
          {[["Upcoming", upcomingMeetings(viewing)], ["Past", pastMeetings(viewing)]].map(([label, items]) => (
            <div key={String(label)} className="mb-3">
              <h3 className="mb-1 text-sm font-semibold">{String(label)}</h3>
              {(items as ReturnType<typeof pastMeetings>).length === 0 ? <p className="text-sm text-muted">No {String(label).toLowerCase()} meetings yet.</p> : (
                <ul className="space-y-1 text-sm">
                  {(items as ReturnType<typeof pastMeetings>).map((item) => (
                    <li key={item.date}>{formatDay(item.date)} · {formatClock(viewing.time)} · {MEETING_STATUS[item.status]} · <a href={/^https?:\/\//.test(viewing.link) ? viewing.link : `https://${viewing.link}`} target="_blank" rel="noreferrer" className="break-all text-brand-700 underline">{viewing.link}</a></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Panel>
      )}
      {rows.length === 0 ? <EmptyState title="No meetings scheduled yet" text={manage ? "Schedule a meeting for an active project." : "Meetings the project manager schedules will show here."} /> : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            { header: "Project", cell: (r) => projects.get(r.projectCode)?.name ?? "Project removed" },
            { header: "Type", cell: (r) => TYPE[projects.get(r.projectCode)?.type as keyof typeof TYPE] ?? "—" },
            ...(user.role === "superadmin" ? [{ header: "Sent to", cell: (r: (typeof rows)[number]) => (r.audience ? AUDIENCE_SHORT[r.audience as keyof typeof AUDIENCE_SHORT] : "By project") }] : []),
            { header: "Repeats", cell: (r) => RECURRENCES[r.recurrence as keyof typeof RECURRENCES] ?? RECURRENCES.none },
            { header: "Date", cell: (r) => formatDay((upcomingMeetings(r)[0] ?? pastMeetings(r)[0])?.date ?? r.startDate) },
            { header: "Time", cell: (r) => formatClock(r.time) },
            { header: "Meeting link", cell: (r) => <a href={/^https?:\/\//.test(r.link) ? r.link : `https://${r.link}`} target="_blank" rel="noreferrer" className="break-all text-brand-700 underline">{r.link}</a> },
            { header: "Status", cell: (r) => { const status = (upcomingMeetings(r)[0] ?? pastMeetings(r)[0])?.status ?? "scheduled"; return <Badge tone={tone(status)}>{MEETING_STATUS[status]}</Badge>; } },
            { header: "Actions", cell: (r) => (
              <div className="flex gap-2">
                <IconLink href={withParam(`view=${r._id}`)} label="View"><Eye /></IconLink>
                {manage && <RowActions id={String(r._id)} editHref={withParam(`edit=${r._id}`)} remove={{ action: deleteMeetingAction, title: "Delete meeting?", text: "The meeting schedule is removed." }} />}
              </div>
            ) },
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ pm, ...keep }} />
    </>
  );
}
