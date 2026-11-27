import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NotificationBell } from "@/components/notification-bell";
import { ScoreChip } from "@/components/score-chip";
import { AreaTabs } from "@/components/area-tabs";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { requireUser } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/permissions";

export default async function DashboardLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  const collapsed = (await cookies()).get("nl_sidebar")?.value === "1";
  const groups = navFor(user.role);
  const name = user.fullName || user.username;
  const roleLabel = `${ROLE_LABEL[user.role]} · ${user.username}`;
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Colombo" }).format(new Date());
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar groups={groups} name={name} roleLabel={roleLabel} collapsedByDefault={collapsed} bell={<div className="flex items-center gap-1.5"><ScoreChip username={user.username} role={user.role} /><NotificationBell username={user.username} /></div>} />
      <div className="min-w-0 flex-1">
        <TopBar name={name} today={today} chip={<ScoreChip username={user.username} role={user.role} />} bell={<NotificationBell username={user.username} />} />
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl"><AreaTabs groups={groups} />{children}</div>
          {modal}
        </main>
      </div>
    </div>
  );
}
