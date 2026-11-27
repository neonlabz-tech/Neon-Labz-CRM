import { HrmsHeader } from "@/components/hrms-header";
import { requireAction } from "@/lib/auth";

export default async function HrmsLayout({ children }: { children: React.ReactNode }) {
  await requireAction("hrms.manage");
  return (
    <>
      <HrmsHeader />
      {children}
    </>
  );
}
