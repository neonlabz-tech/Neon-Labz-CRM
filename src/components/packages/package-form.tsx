import { FileField } from "@/components/ui/file-field";
import Image from "next/image";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { CATEGORIES, DURATIONS } from "@/models/package";
import { savePackageAction } from "@/server/package-actions";

export type PackageDefaults = { id?: string; name?: string; category?: string; description?: string; price?: number; duration?: string; features?: string[]; status?: string; cover?: string };

export function PackageForm({ defaults = {} }: { defaults?: PackageDefaults }) {
  return (
    <ActionForm action={savePackageAction} submit={defaults.id ? "Save package" : "Add package"} toastOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <Field label="Package name" name="name" defaultValue={defaults.name} required />
      <SelectField label="Category" required name="category" defaultValue={defaults.category ?? CATEGORIES[0]}>
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </SelectField>
      <Field label="Price (LKR)" name="price" type="number" step="0.01" min="0" defaultValue={defaults.price} required />
      <SelectField label="Duration" required name="duration" defaultValue={defaults.duration ?? DURATIONS[0]}>
        {DURATIONS.map((d) => <option key={d}>{d}</option>)}
      </SelectField>
      <div className="sm:col-span-2"><TextareaField label="Description" name="description" defaultValue={defaults.description} /></div>
      <div className="sm:col-span-2"><TextareaField label="What is included (one item per line)" name="features" rows={5} defaultValue={defaults.features?.join("\n")} /></div>
      <div className="space-y-2 sm:col-span-2">
        <FileField label="Cover image" name="cover" accept="image/jpeg,image/png,image/webp" hint="JPG, PNG or WebP · up to 3 MB" maxMb={3} />
        {defaults.cover && (
          <div className="flex items-center gap-3 text-sm">
            <Image src={defaults.cover} alt="Current cover" width={64} height={64} unoptimized className="h-16 w-16 rounded-xl object-cover" />
            <label className="flex items-center gap-2"><input type="checkbox" name="removeCover" />Remove this image</label>
          </div>
        )}
      </div>
      <SelectField label="Status" name="status" defaultValue={defaults.status ?? "active"}>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </SelectField>
    </ActionForm>
  );
}
