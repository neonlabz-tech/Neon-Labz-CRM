/** A neat list of label and value pairs for read-only dialogs. Empty values are skipped. */
export function Details({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.filter((item) => item.value !== "" && item.value != null).map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium text-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
