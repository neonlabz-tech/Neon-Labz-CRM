import { Check, Clock } from "lucide-react";
import { PackageIconSvg } from "@/components/packages/icon-picker";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { richHasText, richToHtml } from "@/lib/rich-text";
import { resolveIcon } from "@/lib/package-icons";

type Pkg = { name: string; category: string; description?: string; price: number; duration: string; features: string[]; included?: string; status: string; icon?: string | null };

/** What a salesperson sees when they open a package: the price first, then what the client gets. */
export function PackageView({ pkg }: { pkg: Pkg }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-100 text-[#873CFF]"><PackageIconSvg id={resolveIcon(pkg.icon ?? undefined, pkg.name, pkg.category)} className="h-7 w-7" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{pkg.category}</Badge>
            <Badge tone={pkg.status === "active" ? "success" : "warning"}>{pkg.status === "active" ? "Active" : "Archived"}</Badge>
          </div>
          <p className="mt-1 text-lg font-bold leading-tight text-ink">{pkg.name}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#0B1026] p-4 text-white">
          <p className="text-xs text-[#9CA3AF]">Price</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(pkg.price)}</p>
        </div>
        <div className="rounded-2xl bg-brand-50 p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3.5 w-3.5" />Duration</p>
          <p className="mt-1 text-2xl font-bold text-ink">{pkg.duration || "—"}</p>
        </div>
      </div>

      {pkg.description && <div className="rich max-h-40 overflow-auto text-sm leading-relaxed text-muted" dangerouslySetInnerHTML={{ __html: richToHtml(pkg.description) }} />}

      <div>
        <h3 className="mb-2 text-sm font-semibold">What the client gets</h3>
        {pkg.included && richHasText(pkg.included) ? (
          <div className="rich rounded-xl border border-line bg-white px-3 py-2 text-sm" dangerouslySetInnerHTML={{ __html: richToHtml(pkg.included) }} />
        ) : pkg.features.length === 0 ? (
          <p className="text-sm text-muted">No items listed.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {pkg.features.map((feature, index) => (
              <li key={`${index}-${feature}`} className="flex items-start gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-3 w-3" /></span>
                <span className="min-w-0 break-words">{feature}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
