import { formatMoney } from "@/lib/money";

type Review = {
  receiptNo: string; clientName: string; clientCode: string; quoteNumber: string; salesOwner: string; service: string;
  type: string; method: string; transactionId: string; date: string;
  amount: number; quoteTotal: number; paid: number; approved: boolean; proofUrl?: string;
};

/** The receipt or slip the salesperson attached: an image is shown, a PDF opens in a new tab. */
export function SlipView({ url }: { url?: string }) {
  if (!url) return <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">No slip attached. The transaction or reference no. above was entered instead.</p>;
  const isPdf = /\.pdf($|\?)/i.test(url);
  return (
    <div>
      {isPdf ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-brand-50">Open slip (PDF)</a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" title="Open full size">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Payment slip" className="max-h-80 w-full rounded-xl border border-line object-contain" />
        </a>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-brand-600 hover:underline">Open in a new tab</a>
    </div>
  );
}

/** What the Super Admin checks before approving: the amount, how far the quotation is paid, and the payment details. */
export function PaymentReview({ r }: { r: Review }) {
  const before = Math.max(0, r.approved ? r.paid - r.amount : r.paid);
  const after = before + r.amount;
  const balance = Math.max(0, r.quoteTotal - after);
  const pct = (value: number) => (r.quoteTotal > 0 ? Math.min(100, (100 * value) / r.quoteTotal) : 0);
  const rows: [string, string][] = [
    ["Quotation", r.quoteNumber], ["Sales person", r.salesOwner], ["Service", r.service || "—"], ["Payment type", r.type],
    ["Method", r.method || "—"], ["Transaction no.", r.transactionId || "—"], ["Date", r.date],
  ];
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-[#0B1026] p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{r.clientName}</p>
            <p className="text-xs text-[#9CA3AF]">{r.clientCode} · {r.receiptNo}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.approved ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>{r.approved ? "Approved" : "Waiting for approval"}</span>
        </div>
        <p className="mt-4 text-xs uppercase tracking-widest text-[#B58CFF]">This payment</p>
        <p className="text-3xl font-extrabold">{formatMoney(r.amount)}</p>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`Paid before ${formatMoney(before)}, this payment ${formatMoney(r.amount)}, balance ${formatMoney(balance)}`}>
          <div className="h-full bg-[#6B7280]" style={{ width: `${pct(before)}%` }} />
          <div className="h-full bg-gradient-to-r from-[#873CFF] to-[#C412FC]" style={{ width: `${pct(r.amount)}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div><dt className="text-[#9CA3AF]">Quotation total</dt><dd className="mt-0.5 text-sm font-bold">{formatMoney(r.quoteTotal)}</dd></div>
          <div><dt className="flex items-center gap-1 text-[#9CA3AF]"><i className="inline-block h-2 w-2 rounded-full bg-[#6B7280]" />Paid before</dt><dd className="mt-0.5 text-sm font-bold">{formatMoney(before)}</dd></div>
          <div><dt className="flex items-center gap-1 text-[#9CA3AF]"><i className="inline-block h-2 w-2 rounded-full bg-[#873CFF]" />This payment</dt><dd className="mt-0.5 text-sm font-bold">{formatMoney(r.amount)}</dd></div>
          <div><dt className="text-[#9CA3AF]">{r.approved ? "Balance" : "Balance after approval"}</dt><dd className="mt-0.5 text-sm font-bold">{balance > 0 ? formatMoney(balance) : "Fully paid"}</dd></div>
        </dl>
      </section>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-line pb-2"><dt className="text-xs text-muted">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div>
        ))}
      </dl>
      <section aria-label="Receipt or slip">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Receipt / slip</h3>
        <SlipView url={r.proofUrl} />
      </section>
    </div>
  );
}
