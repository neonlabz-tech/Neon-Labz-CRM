import { NoticeRow } from "@/components/notice-row";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/list-controls";
import { requireUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { pageOf, limitOf, skipOf, type SearchParams } from "@/lib/pagination";
import { formatDateTime } from "@/lib/utils";
import { markNoticesReadAction } from "@/server/notice-actions";
import { Notice } from "@/models/notice";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const page = pageOf(await searchParams);
  await connectDb();
  const [items, total, unread] = await Promise.all([
    Notice.find({ to: user.username }).sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Notice.countDocuments({ to: user.username }),
    Notice.countDocuments({ to: user.username, read: false }),
  ]);

  return (
    <>
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : "You are all caught up."}>
        {unread > 0 && <form action={markNoticesReadAction}><Button type="submit" variant="outline">Mark all as read</Button></form>}
      </PageHeader>
      {items.length === 0 ? <EmptyState title="No notifications yet" text="Payments, assignments and approvals will show up here." /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {items.map((n) => <li key={String(n._id)}><NoticeRow id={String(n._id)} text={n.text} when={formatDateTime(n.createdAt)} link={n.link} read={n.read} /></li>)}
        </ul>
      )}
      <Pagination page={page} total={total} query={{}} />
    </>
  );
}
