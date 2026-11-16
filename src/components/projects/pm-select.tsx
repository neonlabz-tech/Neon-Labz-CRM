"use client";

import { useRouter } from "next/navigation";

/** Super Admin picks whose project records to look at. */
export function PmSelect({ value, options, path, name = "pm" }: { value: string; options: { username: string; label: string }[]; path: string; name?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      Account
      <select value={value} onChange={(event) => router.push(event.target.value ? `${path}?${name}=${encodeURIComponent(event.target.value)}` : path)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm">
        <option value="">All accounts</option>
        {options.map((o) => <option key={o.username} value={o.username}>{o.label}</option>)}
      </select>
    </label>
  );
}
