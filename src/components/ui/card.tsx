import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(28,33,66,0.04)]", className)} {...props} />;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const TONES = [
  "border-[#c9dcf7] bg-[#e4eefc] text-[#1857b8]",
  "border-[#f3e2a6] bg-[#fdf3cf] text-[#9a6a07]",
  "border-[#f6c9c5] bg-[#fde8e6] text-[#b42318]",
  "border-[#bfe8d6] bg-[#e5f7ef] text-[#0b7a55]",
  "border-[#dcc8fb] bg-[#f1e8ff] text-[#6420cc]",
  "border-[#fad5b5] bg-[#fdeede] text-[#b4540a]",
] as const;

/** A soft coloured summary card with an icon chip, a label and a big number. `tone` picks the colour. */
export function ColorCard({ label, value, hint, icon, tone }: { label: string; value: string | number; hint?: string; icon: React.ReactNode; tone: number }) {
  return (
    <article className={cn("flex min-h-28 flex-col justify-between rounded-2xl border p-4 shadow-sm", TONES[tone % TONES.length])}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white shadow-sm [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">{icon}</span>
      <div className="mt-3">
        <p className="text-xs font-medium opacity-80">{label}</p>
        <p className="mt-0.5 break-words text-xl font-bold leading-tight text-ink">{value}</p>
        {hint && <p className="mt-1 text-[11px] opacity-75">{hint}</p>}
      </div>
    </article>
  );
}

/** The same card for list pages; the colour follows the label so it stays the same between visits. */
export function Stat({ label, value, hint, icon }: { label: string; value: string | number; hint?: string; icon: React.ReactNode }) {
  const tone = [...label].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return <ColorCard label={label} value={value} hint={hint} icon={icon} tone={tone} />;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Inbox className="h-6 w-6" /></span>
      <p className="mt-4 font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{text}</p>
    </div>
  );
}
