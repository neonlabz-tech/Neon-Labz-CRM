import { AccessBar } from "@/components/projects/access-bar";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { User } from "@/models/user";

/** The Super Admin's account picker and project tabs above the report lists. */
export async function ReportsTop({ own, pm }: { own: boolean; pm: string }) {
  const accounts = own ? [] : await User.find({ role: "pm" }).select("username fullName").sort({ username: 1 }).lean();
  return (
    <>
      <AccessBar own={own} pm={pm} path="/reports" accounts={accounts.map((a) => ({ username: a.username, label: a.fullName || a.username }))} />
      <ProjectTabs active="/reports" own={own} pm={pm} reports />
    </>
  );
}
