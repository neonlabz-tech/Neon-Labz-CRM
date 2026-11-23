"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { IconLink } from "@/components/ui/icon-link";
import { deletePackageAction, duplicatePackageAction } from "@/server/package-actions";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";

/** Edit and Delete for a package. Archiving is no longer offered from the list. */
export function PackageRowActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <>
      <IconLink href={`/packages/${id}`} label="Edit"><Pencil /></IconLink>
      <Button size="iconSm" variant="outline" title="Duplicate" aria-label="Duplicate package" disabled={pending} onClick={() => start(async () => {
        const result = await duplicatePackageAction(id);
        toast(result.ok, result.message);
      })}><Copy className="h-4 w-4" /></Button>
      <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Delete" title="Delete this package?" text="This cannot be undone. Old quotations keep their own copy of the package." confirmLabel="Delete" run={() => deletePackageAction(id)} />
    </>
  );
}
