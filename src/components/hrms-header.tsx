"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { SubNav } from "@/components/ui/subnav";

/** The HRMS pages share a title and tabs. Productivity has its own sidebar entry, so it gets its own title and no tabs. */
export function HrmsHeader() {
  const path = usePathname();
  if (path === "/hrms/productivity" || path.startsWith("/hrms/productivity/")) {
    return <PageHeader title="Productivity" subtitle="Who finished their tasks, who is working and who is behind." />;
  }
  return (
    <>
      <PageHeader title="HRMS" subtitle="Employees, departments, leave and activities." />
      <SubNav tabs={[
        { href: "/hrms", label: "Employees" }, { href: "/hrms/departments", label: "Departments" },
        { href: "/hrms/leaves", label: "Leave" }, { href: "/hrms/activities", label: "Activities" },
      ]} />
    </>
  );
}
