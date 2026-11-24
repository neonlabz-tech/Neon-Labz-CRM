import { PeriodFilter } from "@/components/finance/period-filter";
import { connectDb } from "@/lib/db";
import { dateIn, periodNote, timeIn } from "@/lib/dashboard";
import { todayISO } from "@/lib/dates";
import { MONTHS, readPeriod } from "@/lib/finance";
import { historyClientCodes, historyProjectCodes, visibleProjectFilter } from "@/lib/project-access";
import { PROJECT_STATUS, statusFor } from "@/lib/projects";
import type { SearchParams } from "@/lib/pagination";
import { Issue } from "@/models/issue";
import { MarketingInfo } from "@/models/marketing-info";
import { MarketingPlan } from "@/models/marketing-plan";
import { MarketingReport } from "@/models/marketing-report";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { Bars, ChartGrid, Hero, Kpis, Ring, slices } from "./widgets";

export async function MarketingDashboard({ username, sp }: { username: string; sp: SearchParams }) {
  const { year, month, prefix } = readPeriod(sp, todayISO());
  await connectDb();
  const projectMatch = { ...(await visibleProjectFilter({ role: "marketing", username })), archived: false, ...dateIn(prefix, "startDate", "dueDate") };
  // Projects in History (and clients whose projects are all in History) stay out of these numbers.
  const [hiddenClients, hiddenProjects] = await Promise.all([historyClientCodes(), historyProjectCodes()]);
  const range = { ...dateIn(prefix, "startDate", "endDate"), clientCode: { $nin: hiddenClients } };
  const [ids, docs, plans, reports, issues] = await Promise.all([
    Project.find(projectMatch).select("_id type status softwareStatus marketingStatus").lean(),
    MarketingInfo.countDocuments({ clientCode: { $nin: hiddenClients } }),
    MarketingPlan.countDocuments(range),
    MarketingReport.countDocuments(range),
    Issue.countDocuments({ createdBy: username, projectCode: { $nin: hiddenProjects }, ...dateIn(prefix, "reportedAt", "dueDate") }),
  ]);
  // The marketing part decides what counts as completed here.
  const byStatus: Record<string, number> = {};
  for (const p of ids) byStatus[statusFor("marketing", p)] = (byStatus[statusFor("marketing", p)] ?? 0) + 1;
  const taskTime = timeIn(prefix);
  const taskMatch = { projectId: { $in: ids.map((p) => p._id) }, department: "marketing" as const, ...(prefix ? { $or: [...(dateIn(prefix, "startDate", "dueDate").$or as object[]), { completedAt: taskTime }] } : {}) };
  const [tasks, working] = await Promise.all([Task.countDocuments(taskMatch), Task.countDocuments({ ...taskMatch, status: "in-progress" })]);
  return (
    <>
      <PeriodFilter year={year} month={month} basePath="/dashboard" />
      <Hero kicker={username} title="Marketing dashboard" note={periodNote(year, month, MONTHS)} badge={`${reports} reports`} />
      <Kpis items={[{ label: "Projects", value: ids.length }, { label: "Info documents", value: docs }, { label: "Content plans", value: plans }, { label: "Reports", value: reports }, { label: "Total tasks", value: tasks }, { label: "In progress", value: working }, { label: "Issues", value: issues }]} />
      <ChartGrid>
        <Ring title="Projects" data={slices(Object.entries(PROJECT_STATUS), byStatus)} />
        <Bars title="Marketing work" data={slices([["docs", "Info documents"], ["plans", "Content plans"], ["reports", "Reports"]], { docs, plans, reports })} />
      </ChartGrid>
    </>
  );
}
