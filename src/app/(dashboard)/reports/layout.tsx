import { PageHeader } from "@/components/ui/card";
import { SubNav } from "@/components/ui/subnav";
import { requireAction } from "@/lib/auth";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireAction("reports.manage");
  return (
    <>
      <PageHeader title="Reports" subtitle="Requirement documents, proposals and demo videos for your projects." />
      <SubNav tabs={[{ href: "/reports", label: "SRS documents" }, { href: "/reports/proposals", label: "Proposals" }, { href: "/reports/videos", label: "Demo videos" }]} />
      {children}
    </>
  );
}
