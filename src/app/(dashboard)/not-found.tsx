import Link from "next/link";
import { Lock } from "lucide-react";

export const metadata = { title: "Page not available" };

/** Shown for a page that does not exist or that the signed-in role may not open. The address stays as typed. */
export default function NotAvailable() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Lock className="h-6 w-6" /></span>
      <h1 className="text-lg font-bold">This page is not available</h1>
      <p className="mt-2 text-sm text-muted">It does not exist, or your role does not have access to it.</p>
      <Link prefetch={false} href="/dashboard" className="brand-gradient mt-6 inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white">Back to dashboard</Link>
    </div>
  );
}
