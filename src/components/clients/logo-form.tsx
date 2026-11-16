"use client";

import Image from "next/image";
import { ImagePlus } from "lucide-react";
import { useState } from "react";
import { DialogButton } from "@/components/ui/dialog-button";
import { FileField } from "@/components/ui/file-field";
import { ActionForm } from "@/components/ui/form";
import { initials } from "@/lib/utils";
import { saveClientLogoAction } from "@/server/client-actions";

/** The form that uploads, replaces or removes a client's logo. */
export function LogoUpload({ code, hasLogo }: { code: string; hasLogo: boolean }) {
  return (
    <ActionForm action={saveClientLogoAction} submit="Save logo" className="space-y-3">
      <input type="hidden" name="code" value={code} />
      <FileField label="Logo" name="logo" accept="image/jpeg,image/png,image/webp" hint="JPG, PNG or WebP · up to 2 MB" maxMb={2} />
      {hasLogo && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removeLogo" />Remove the logo</label>}
    </ActionForm>
  );
}

/** The client's logo (or its initials when there is none or it cannot load). Adding a logo is offered here; changing it happens in the edit window. */
export function ClientLogo({ code, name, logo }: { code: string; name: string; logo: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {logo && !broken ? (
        <Image src={logo} alt={`${name} logo`} width={40} height={40} unoptimized onError={() => setBroken(true)} className="h-10 w-10 shrink-0 rounded-lg border border-line bg-white object-contain" />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700" aria-hidden>{initials(name)}</span>
      )}
      {!logo && (
        <DialogButton label="Add logo" text="Add logo" title={`${name} · logo`} headerIcon={<ImagePlus className="h-5 w-5" />}>
          <LogoUpload code={code} hasLogo={false} />
        </DialogButton>
      )}
    </div>
  );
}
