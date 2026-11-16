import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminDashboard } from "@/components/dashboard/admin";
import { EmployeeDashboard } from "@/components/dashboard/employee";
import { MarketingDashboard } from "@/components/dashboard/marketing";
import { PmDashboard } from "@/components/dashboard/pm";
import { SalesDashboard } from "@/components/dashboard/sales";
import type { SearchParams } from "@/lib/pagination";
import { formatDateTime } from "@/lib/utils";
import { markNoticesReadAction } from "@/server/notice-actions";
import { Notice } from "@/models/notice";
import { requireUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";

export const metadata = { title: "Dashboard" };

async function Notices({ username }: { username: string }) {
  await connectDb();
  const items = await Notice.find({ to: username, read: false }).sort({ createdAt: -1 }).limit(10).lean();
  if (items.length === 0) return null;
  return (
    <Card className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">New for you</h2>
        <form action={markNoticesReadAction}><Button type="submit" size="sm" variant="ghost">Mark all as read</Button></form>
      </div>
      <ul className="divide-y divide-line text-sm">
        {items.map((n) => (
          <li key={String(n._id)} className="py-2.5">
            {n.link ? <Link prefetch={false} href={n.link} className="font-medium text-brand-700 hover:underline">{n.text}</Link> : n.text}
            <span className="ml-2 text-xs text-muted">{formatDateTime(n.createdAt)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const name = user.fullName || user.username;
  const board = {
    superadmin: <AdminDashboard username={user.username} sp={sp} />,
    pm: <PmDashboard username={user.username} sp={sp} />,
    marketing: <MarketingDashboard username={user.username} sp={sp} />,
    sales: <SalesDashboard username={user.username} sp={sp} />,
    employee: <EmployeeDashboard username={user.username} name={name} sp={sp} />,
  }[user.role];
  return (
    <>
      {board}
      <Notices username={user.username} />
    </>
  );
}
