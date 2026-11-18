"use client";

import { Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { IconLink } from "@/components/ui/icon-link";
import { deletePackageAction } from "@/server/package-actions";

/** Edit and Delete for a package. Archiving is no longer offered from the list. */
export function PackageRowActions({ id }: { id: string }) {
  return (
    <>
      <IconLink href={`/packages/${id}`} label="Edit"><Pencil /></IconLink>
      <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title="Delete this package?" text="This cannot be undone. Old quotations keep their own copy of the package." confirmLabel="Delete" run={() => deletePackageAction(id)} />
    </>
  );
}
