"use client";

import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { deleteClientAction } from "@/server/client-actions";

/** The Super Admin removes a client. The server refuses when the client already has a project or payment records. */
export function DeleteClientButton({ code, name }: { code: string; name: string }) {
  return (
    <ConfirmButton
      icon={<Trash2 className="h-4 w-4" />}
      label="Remove client"
      title={`Remove ${name}?`}
      text="Only a client with no project, payment or receipt can be removed. This cannot be undone."
      confirmLabel="Remove"
      run={() => deleteClientAction(code)}
    />
  );
}
