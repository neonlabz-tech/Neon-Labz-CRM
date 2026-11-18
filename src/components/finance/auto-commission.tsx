"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { monthLabel } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { earnedCommissionAction } from "@/server/finance-actions";

/**
 * The commission field of the payroll form. Choosing a salesperson (or changing the commission month) fills in the commission still due that month (earned minus already paid).
 * The amount can still be changed by hand. Saving the payment as Paid is what marks that commission Paid in Sales > Commission.
 */
export function AutoCommission({ logins, defaultValue }: { logins: Record<string, string>; defaultValue: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    let turn = 0;
    async function sync(fill: boolean) {
      const employee = (form!.elements.namedItem("employee") as HTMLSelectElement | null)?.value ?? "";
      const date = (form!.elements.namedItem("commissionMonth") as HTMLInputElement | null)?.value ?? "";
      const login = logins[employee];
      const mine = ++turn;
      if (!login || !/^\d{4}-\d{2}$/.test(date)) { setHint(""); return; }
      const result = await earnedCommissionAction(login, date).catch(() => null);
      if (mine !== turn) return;
      if (!result?.applies) { setHint(""); return; }
      setHint(`${login} earned ${formatMoney(result.earned)} in ${monthLabel(date)} (${result.rate}% of ${formatMoney(result.sales)} approved sales)${result.paid > 0 ? `, already paid ${formatMoney(result.paid)}, balance ${formatMoney(result.due)}` : ""}.${fill ? " Filled in for you." : ""}`);
      if (fill) {
        const input = form!.elements.namedItem("commission") as HTMLInputElement | null;
        if (input) input.value = String(result.due);
      }
    }
    const onChange = (event: Event) => {
      const name = (event.target as HTMLInputElement).name;
      if (name === "employee" || name === "commissionMonth") void sync(true);
    };
    form.addEventListener("change", onChange);
    void sync(false);
    return () => form.removeEventListener("change", onChange);
  }, [logins]);

  return (
    <div ref={box}>
      <Field label="Commission (LKR)" required name="commission" type="number" min="0" step="0.01" defaultValue={defaultValue} />
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
