import { cn } from "@/lib/utils";
import { RowLink } from "./row-link";
import { ScrollBox } from "./scroll-box";

/** Shared look for every table, including the few written by hand. */
export const tableStyles = {
  shell: "overflow-x-auto overflow-y-hidden rounded-2xl border border-line bg-white shadow-[0_1px_3px_rgba(28,33,66,0.06)]",
  table: "w-full text-left text-xs",
  head: "border-b border-line bg-canvas text-[11px] font-bold uppercase tracking-wider text-muted",
  th: "sticky top-0 z-10 whitespace-nowrap bg-canvas px-6 py-4",
  body: "divide-y divide-line/70",
  row: "bg-white transition-colors hover:bg-brand-50/40",
  td: "whitespace-nowrap px-6 py-4 align-middle text-ink/90",
  text: "max-w-[22rem] truncate",
};

export type Column<T> = { header: string; cell: (row: T) => React.ReactNode; className?: string };

/** A row that is a link when it has somewhere to go, and a plain row when it does not. */
function Row({ as, href, className, children }: { as: "tr" | "li"; href?: string; className?: string; children: React.ReactNode }) {
  if (href) return <RowLink as={as} href={href} className={className}>{children}</RowLink>;
  return as === "tr" ? <tr className={className}>{children}</tr> : <li className={className}>{children}</li>;
}

/** A table on tablet and desktop, a stack of cards on phones. The first column is the card title. */
export function DataTable<T>({ rows, columns, rowKey, rowHref }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; /** Where a click on the row goes (for example the edit window). */ rowHref?: (row: T) => string }) {
  const [title, ...rest] = columns;
  if (!title) return null;
  return (
    <>
      <ScrollBox className={cn(tableStyles.shell, "hidden md:block")}>
        <table className={tableStyles.table}>
          <thead className={tableStyles.head}>
            <tr>{columns.map((c) => <th key={c.header} className={tableStyles.th}>{c.header}</th>)}</tr>
          </thead>
          <tbody className={tableStyles.body}>
            {rows.map((row) => (
              <Row key={rowKey(row)} as="tr" href={rowHref?.(row)} className={tableStyles.row}>{columns.map((c) => {
                const content = c.cell(row);
                const plain = typeof content === "string";
                return <td key={c.header} title={plain ? content : undefined} className={cn(tableStyles.td, plain && tableStyles.text, c.className)}>{content}</td>;
              })}</Row>
            ))}
          </tbody>
        </table>
      </ScrollBox>
      <ScrollBox className="md:hidden"><ul className="space-y-3">
        {rows.map((row) => (
          <Row key={rowKey(row)} as="li" href={rowHref?.(row)} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold">{title.cell(row)}</div>
            <dl className="mt-2 space-y-1.5 text-xs">
              {rest.map((c) => (
                <div key={c.header} className="flex items-start justify-between gap-3">
                  <dt className="text-muted">{c.header}</dt>
                  <dd className="text-right">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </Row>
        ))}
      </ul></ScrollBox>
    </>
  );
}
