import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="brand-gradient bg-clip-text text-6xl font-extrabold text-transparent">404</p>
        <h1 className="mt-3 text-2xl font-bold">We could not find that page</h1>
        <p className="mt-2 text-sm text-muted">The link may be old, or the record was removed.</p>
        <Link href="/dashboard" className="brand-gradient mt-6 inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white">Back to dashboard</Link>
      </div>
    </main>
  );
}
