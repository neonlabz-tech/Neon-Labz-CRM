"use client";

import { useEffect, useRef, useState } from "react";
import { SelectField } from "@/components/ui/field";
import { UNASSIGNED } from "@/models/manual-sale-values";

type Goes = "project" | "marketing" | "both" | "own";

/** What the picked packages say about who does the work, or null when none of them is a known package. */
function fromPackages(names: string, categories: Record<string, string>): Goes | null {
  let project = false;
  let marketing = false;
  let known = false;
  for (const name of names.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean)) {
    const category = categories[name];
    if (!category) continue;
    known = true;
    if (category === "Software development" || category === "Both") project = true;
    if (category === "Marketing" || category === "Both") marketing = true;
  }
  if (!known) return null;
  return project && marketing ? "both" : marketing ? "marketing" : "project";
}

/**
 * "Goes to": who handles the work once the sale is confirmed. It fills itself from the packages picked above
 * until the person chooses by hand. "Handled by the Super Admin" shows only while the salesperson is Unassigned.
 */
export function GoesToField({ defaultValue, defaultOwner, categories }: { defaultValue: string; defaultOwner: string; categories: Record<string, string> }) {
  const holder = useRef<HTMLDivElement>(null);
  const chosen = useRef(Boolean(defaultValue) && defaultValue !== "project");
  const [value, setValue] = useState<Goes>((defaultValue || "project") as Goes);
  const [unassigned, setUnassigned] = useState(defaultOwner === UNASSIGNED);

  useEffect(() => {
    const form = holder.current?.closest("form");
    if (!form) return;
    const read = () => {
      const owner = (form.elements.namedItem("owner") as HTMLSelectElement | null)?.value ?? "";
      const service = (form.elements.namedItem("service") as HTMLInputElement | null)?.value ?? "";
      const isUnassigned = owner === UNASSIGNED;
      setUnassigned(isUnassigned);
      setValue((current) => {
        if (current === "own" && !isUnassigned) return "project";
        if (chosen.current) return current;
        return fromPackages(service, categories) ?? current;
      });
    };
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => { form.removeEventListener("input", read); form.removeEventListener("change", read); };
  }, [categories]);

  return (
    <div ref={holder}>
      <SelectField label="Goes to" required name="goesTo" value={value} onChange={(event) => { chosen.current = true; setValue(event.target.value as Goes); }}>
        <option value="project">Project (Project manager)</option>
        <option value="marketing">Marketing team</option>
        <option value="both">Both: project and marketing</option>
        {unassigned && <option value="own">Super Admin handles it (own)</option>}
      </SelectField>
    </div>
  );
}
