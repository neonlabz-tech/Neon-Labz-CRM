"use client";

import { Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "./confirm";
import { IconLink } from "./icon-link";
import type { ActionState } from "@/types";

export function RowActions({ id, editHref, remove }: {
  id: string; editHref: string;
  remove?: { action: (id: string) => Promise<ActionState>; title: string; text: string };
}) {
  return (
    <div className="flex gap-2">
      <IconLink href={editHref} label="Edit"><Pencil /></IconLink>
      {remove && <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title={remove.title} text={remove.text} confirmLabel="Delete" run={() => remove.action(id)} />}
    </div>
  );
}
