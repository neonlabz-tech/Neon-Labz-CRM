import Image from "next/image";
import { DialogButton } from "@/components/ui/dialog-button";
import { Details } from "@/components/ui/details";
import Link from "next/link";
import { PdfLink } from "@/components/ui/pdf-link";
import { Eye, Plus } from "lucide-react";
import { PackageRowActions } from "@/components/packages/package-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination, SearchBar } from "@/components/ui/list-controls";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { escapeRegex, pageOf, limitOf, skipOf, param, type SearchParams } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { CATEGORIES, Package } from "@/models/package";

export const metadata = { title: "Packages" };

export default async function PackagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("packages.view");
  const manage = can(user.role, "packages.manage");
  const sp = await searchParams;
  const q = param(sp, "q");
  const category = param(sp, "category");
  const status = param(sp, "status");
  const page = pageOf(sp);

  const filter: Record<string, unknown> = manage ? {} : { status: "active" };
  if (CATEGORIES.includes(category as never)) filter.category = category;
  if (manage && (status === "active" || status === "archived")) filter.status = status;
  if (q) filter.name = new RegExp(escapeRegex(q), "i");

  await connectDb();
  const [rows, total] = await Promise.all([
    Package.find(filter).select("name category description price duration features status cover").sort({ createdAt: -1 }).skip(skipOf(page)).limit(limitOf(page)).lean(),
    Package.countDocuments(filter),
  ]);

  const filters: { name: string; label: string; value: string; options: { value: string; label: string }[] }[] = [{ name: "category", label: "All categories", value: category, options: CATEGORIES.map((c) => ({ value: c, label: c })) }];
  if (manage) filters.push({ name: "status", label: "All statuses", value: status, options: [{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }] });

  return (
    <>
      <PageHeader title="Packages" subtitle={manage ? "The services you sell. Quotations are built from these." : "The services you can quote. Only the Super Admin can change them."}>
        {manage && <Link prefetch={false} href="/packages/new" className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add package</Link>}
      </PageHeader>
      <SearchBar q={q} placeholder="Search packages" filters={filters} />
      {rows.length === 0 ? (
        <EmptyState title="No packages yet" text={manage ? "Add your first package to start building quotations." : "The Super Admin has not added packages yet."} />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => String(r._id)}
          columns={[
            {
              header: "Package",
              cell: (r) => (
                <span className="flex items-center gap-3">
                  {r.cover ? <Image src={r.cover} alt="" width={48} height={32} className="h-8 w-12 rounded-md object-cover" /> : <span className="h-8 w-12 rounded-md bg-brand-100" />}
                  {r.name}
                </span>
              ),
            },
            { header: "Category", cell: (r) => r.category },
            { header: "Price", cell: (r) => formatMoney(r.price) },
            { header: "Duration", cell: (r) => r.duration },
            { header: "Includes", cell: (r) => `${r.features.length} items` },
            { header: "Status", cell: (r) => <Badge tone={r.status === "active" ? "success" : "warning"}>{r.status === "active" ? "Active" : "Archived"}</Badge> },
            {
              header: "View",
              cell: (r: (typeof rows)[number]) => (
                <DialogButton label="View full package" title={r.name} icon={<Eye />}>
                  {r.cover && <Image src={r.cover} alt="" width={640} height={320} className="mb-4 h-40 w-full rounded-xl object-cover" />}
                  <Details items={[{ label: "Category", value: r.category }, { label: "Price", value: formatMoney(r.price) }, { label: "Duration", value: r.duration }, { label: "Status", value: r.status === "active" ? "Active" : "Archived" }, { label: "Description", value: r.description }]} />
                  <h3 className="mb-2 mt-5 text-sm font-semibold">What is included</h3>
                  {r.features.length === 0 ? <p className="text-muted">No items listed.</p> : <ul className="list-disc space-y-1 pl-5">{r.features.map((f: string, i: number) => <li key={`${i}-${f}`}>{f}</li>)}</ul>}
                </DialogButton>
              ),
            },
            { header: "PDF", cell: (r: (typeof rows)[number]) => <PdfLink kind="package" id={String(r._id)} /> },
            ...(manage ? [{ header: "Actions", cell: (r: (typeof rows)[number]) => <PackageRowActions id={String(r._id)} status={r.status} /> }] : []),
          ]}
        />
      )}
      <Pagination page={page} total={total} query={{ q, category, status }} />
    </>
  );
}
