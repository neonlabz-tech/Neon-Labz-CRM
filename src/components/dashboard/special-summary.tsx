import Link from "next/link";
import { connectDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { SPECIAL_TYPES, SpecialClient, SpecialDoc } from "@/models/special";
import { Kpis, Panel } from "./widgets";

const KIND_LABEL: Record<string, string> = { quotation: "Quotation", proposal: "Proposal", srs: "SRS" };
const TAB: Record<string, string> = { quotation: "quotations", proposal: "proposals", srs: "srs" };

/** The Super Admin's summary of the Special Clients area: how many clients and documents, and what was made last. */
export async function SpecialSummary() {
  await connectDb();
  const [types, kinds, quoted, recent] = await Promise.all([
    SpecialClient.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$type", n: { $sum: 1 } } }]),
    SpecialDoc.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$kind", n: { $sum: 1 } } }]),
    SpecialDoc.aggregate<{ n: number }>([{ $match: { kind: "quotation" } }, { $group: { _id: null, n: { $sum: "$total" } } }]),
    SpecialDoc.find().select("kind number clientName title total createdAt").sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  const byType = new Map(types.map((row) => [row._id, row.n]));
  const byKind = new Map(kinds.map((row) => [row._id, row.n]));
  const clients = [...byType.values()].reduce((a, b) => a + b, 0);
  const split = SPECIAL_TYPES.filter((type) => byType.get(type)).map((type) => `${type} ${byType.get(type)}`).join(" · ");
  return (
    <section aria-label="Special Clients">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Special Clients</h2>
        <Link prefetch={false} href="/special-clients" className="text-sm font-semibold text-brand-700 hover:underline">Open</Link>
      </div>
      <Kpis items={[
        { label: "Special clients", value: clients, hint: split || "None yet" },
        { label: "Quotations", value: byKind.get("quotation") ?? 0, hint: `Worth ${formatMoney(quoted[0]?.n ?? 0)}` },
        { label: "Proposals", value: byKind.get("proposal") ?? 0 },
        { label: "SRS documents", value: byKind.get("srs") ?? 0 },
      ]} />
      <Panel title="Latest special documents" empty="No special client documents yet.">
        {recent.length > 0 ? (
          <ul className="divide-y divide-line text-sm">
            {recent.map((doc) => (
              <li key={String(doc._id)} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <Link prefetch={false} href={`/special-clients/${TAB[doc.kind]}`} className="font-medium text-brand-700 hover:underline">{doc.number}</Link>
                <span className="text-muted">{KIND_LABEL[doc.kind]} · {doc.clientName}{doc.title ? ` · ${doc.title}` : ""}</span>
                <span className="text-xs text-muted">{doc.kind === "quotation" ? `${formatMoney(doc.total)} · ` : ""}{formatDateTime(doc.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : undefined}
      </Panel>
    </section>
  );
}
