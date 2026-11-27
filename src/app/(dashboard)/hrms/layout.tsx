import { PageHeader } from "@/components/ui/card";
import { SubNav } from "@/components/ui/subnav";
import { requireAction } from "@/lib/auth";

export default async function HrmsLayout({ children }: { children: React.ReactNode }) {
  await requireAction("hrms.manage");
  return (
    <>
      <PageHeader title="HRM" subtitle="People, departments, leave, activities and productivity." />
      <SubNav tabs={[
        { href: "/hrms", label: "Employees" }, { href: "/hrms/departments", label: "Departments" },
        { href: "/hrms/leaves", label: "Leave" }, { href: "/hrms/activities", label: "Activities" }, { href: "/hrms/productivity", label: "Productivity" },
      ]} />
      {children}
    </>
  );
}
