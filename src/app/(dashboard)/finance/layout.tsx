import { PageHeader } from "@/components/ui/card";
import { SubNav } from "@/components/ui/subnav";
import { requireAction } from "@/lib/auth";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireAction("finance.view");
  return (
    <>
      <PageHeader title="Finance" subtitle="Payroll, expenses and revenue." />
      <SubNav tabs={[{ href: "/finance/payroll", label: "Payroll" }, { href: "/finance/expenses", label: "Expenses" }, { href: "/finance/revenue", label: "Revenue" }]} />
      {children}
    </>
  );
}
