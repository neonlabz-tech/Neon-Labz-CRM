import { cache, Suspense } from "react";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Notice } from "@/models/notice";
import { BellMenu } from "@/components/bell-menu";

/** One read per request, shared by the desktop and mobile headers. */
const load = cache(async (username: string) => {
  await connectDb();
  const [unread, items] = await Promise.all([
    Notice.countDocuments({ to: username, read: false }),
    Notice.find({ to: username }).sort({ createdAt: -1 }).limit(15).lean(),
  ]);
  return { unread, items: items.map((n) => ({ id: String(n._id), text: n.text, link: n.link, read: n.read, when: formatDateTime(n.createdAt) })) };
});

async function Loaded({ username }: { username: string }) {
  const { unread, items } = await load(username);
  return <BellMenu unread={unread} items={items} />;
}

/** Streams in after the page, so notifications never hold the page back. */
export function NotificationBell({ username }: { username: string }) {
  return (
    <Suspense fallback={<BellMenu unread={0} items={[]} />}>
      <Loaded username={username} />
    </Suspense>
  );
}
