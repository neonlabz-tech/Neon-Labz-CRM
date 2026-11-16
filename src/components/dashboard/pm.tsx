import { PeriodFilter } from "@/components/finance/period-filter";
import { connectDb } from "@/lib/db";
import { dateIn, group, periodNote, timeIn } from "@/lib/dashboard";
import { todayISO } from "@/lib/dates";
import { MONTHS, readPeriod } from "@/lib/finance";
import { ISSUE_PRIORITIES } from "@/lib/issues";
import { visibleProjectFilter } from "@/lib/project-access";
import { PRIORITY, PROJECT_STATUS, statusFor } from "@/lib/projects";
import type { SearchParams } from "@/lib/pagination";
import { Client } from "@/models/client";
import { Issue } from "@/models/issue";
import { Project } from "@/models/project";
import { DemoVideo, Proposal, Srs } from "@/models/report";
import { Task } from "@/models/task";
import { clientWorkFilter } from "@/lib/work-type";
import { Bars, ChartGrid, Hero, Kpis, PALETTE, Ring, slices, toCounts } from "./widgets";

export async function PmDashboard({ username, sp }: { username: string; sp: SearchParams }) {
  const { year, month, prefix } = readPeriod(sp, todayISO());
  await connectDb();
  const projectMatch = { ...(await visibleProjectFilter({ role: "pm", username })), archived: false, ...dateIn(prefix, "startDate", "dueDate") };
  const taskTime = timeIn(prefix);
  const issueMatch = { createdBy: username, ...dateIn(prefix, "reportedAt", "dueDate") };
  const mine = { owner: username, ...dateIn(prefix, "date") };
  const ids = await Project.find(projectMatch).select("_id type status softwareStatus marketingStatus").lean();
  // The software part decides what counts as completed here.
  const status: Record<string, number> = {};
  for (const p of ids) status[statusFor("pm", p)] = (status[statusFor("pm", p)] ?? 0) + 1;
  const taskMatch = { projectId: { $in: ids.map((p) => p._id) }, department: "software" as const, ...(prefix ? { $or: [...(dateIn(prefix, "startDate", "dueDate").$or as object[]), { completedAt: taskTime }] } : {}) };
  const [byPriority, byIssue, clients, byService, srs, proposals, videos] = await Promise.all([
    Task.aggregate<{ _id: string; n: number }>(group("priority", taskMatch)),
    Issue.aggregate<{ _id: string; n: number }>(group("priority", issueMatch)),
    Client.countDocuments(clientWorkFilter("pm")),
    Client.aggregate<{ _id: string; n: number }>(group("service", clientWorkFilter("pm"))),
    Srs.countDocuments(mine),
    Proposal.countDocuments(mine),
    DemoVideo.countDocuments(mine),
  ]);
  const tasks = byPriority.reduce((sum, row) => sum + row.n, 0);
  const issues = byIssue.reduce((sum, row) => sum + row.n, 0);
  const projects = Object.values(status).reduce((a, b) => a + b, 0);
  return (
    <>
      <PeriodFilter year={year} month={month} basePath="/dashboard" />
      <Hero kicker={username} title="Project dashboard" note={periodNote(year, month, MONTHS)} badge={`${status["in-progress"] ?? 0} in progress`} />
      <Kpis items={[{ label: "Projects", value: projects }, { label: "In progress", value: status["in-progress"] ?? 0 }, { label: "Tasks", value: tasks }, { label: "Issues", value: issues }, { label: "Clients", value: clients }]} />
      <ChartGrid cols={3}>
        <Ring title="Projects" data={slices(Object.entries(PROJECT_STATUS), status)} />
        <Ring title="Tasks" data={slices(Object.entries(PRIORITY), toCounts(byPriority))} />
        <Ring title="Issues" data={slices(Object.entries(ISSUE_PRIORITIES), toCounts(byIssue))} />
      </ChartGrid>
      <ChartGrid>
        <Bars title="Clients by service" data={byService.map((row, index) => ({ id: String(row._id), label: String(row._id || "Not set"), value: row.n, color: PALETTE[index % PALETTE.length]! }))} />
        <Bars title="Reports" data={slices([["srs", "SRS documents"], ["proposals", "Proposals"], ["videos", "Demo videos"]], { srs, proposals, videos })} />
      </ChartGrid>
    </>
  );
}
