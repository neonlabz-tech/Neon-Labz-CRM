"use client";

import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm";
import { deleteGuestAction } from "@/server/manual-sale-actions";

/** Removes a guest client that was added by mistake. It is refused once the client has a project. */
export function GuestActions({ id }: { id: string }) {
  return <ConfirmButton icon={<Trash2 className="h-4 w-4" />} label="Remove guest" title="Remove this guest?" text="The client is removed too. This is refused once a project has been started for it." confirmLabel="Remove" run={() => deleteGuestAction(id)} />;
}
