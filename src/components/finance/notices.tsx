import Link from "next/link";
import { Card } from "@/components/ui/card";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Notice } from "@/models/notice";

/** The latest few notifications for this person, shown at the top of Finance. */
export async function FinanceNotices({ username }: { username: string }) {
  await connectDb();
  const items = await Notice.find({ to: username }).sort({ createdAt: -1 }).limit(5).lean();
  return (
    <Card className="mb-5">
      <h2 className="mb-2 font-semibold">Notifications</h2>
      {items.length === 0 ? <p className="text-sm text-muted">No notifications yet.</p> : (
        <ul className="divide-y divide-line text-sm">
          {items.map((n) => (
            <li key={String(n._id)} className="py-2">
              {n.link ? <Link href={n.link} className={n.read ? "hover:underline" : "font-medium text-brand-700 hover:underline"}>{n.text}</Link> : n.text}
              <span className="ml-2 text-xs text-muted">{formatDateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
