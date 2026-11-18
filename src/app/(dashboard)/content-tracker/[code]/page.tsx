import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TrackerTable } from "@/components/content-tracker/tracker-table";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { contentTypeList, loadTracker } from "@/lib/content-tracker-data";
import { findProject } from "@/lib/project-access";
import { teamMembersFor } from "@/lib/team";

export const metadata = { title: "Content Tracker" };

export default async function ContentTrackerProjectPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireAction("content.track");
  const { code } = await params;
  const project = await findProject(user, code);
  if (!project || project.type === "software") notFound();

  const [rows, types, members] = await Promise.all([loadTracker(project.code, project.clientCode), contentTypeList(), teamMembersFor("marketing")]);
  const assignees = members.map((m) => ({ username: m.username, name: m.name }));

  return (
    <>
      <PageHeader title={`${project.name} · Content Tracker`} subtitle={`${project.clientName} · ${project.code}. Date, time, topic and type come from the content plan; the rest you fill in here and it saves as you go.`}>
        <Link href="/content-tracker" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />All projects</Link>
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyState title="No content planned yet" text={`There are no posts in a content plan for ${project.clientName}. Add posts in Content plans and they will appear here.`} />
      ) : (
        <TrackerTable projectCode={project.code} rows={rows} assignees={assignees} types={types} />
      )}
    </>
  );
}
