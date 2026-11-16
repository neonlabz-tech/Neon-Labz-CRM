import { PackageForm } from "@/components/packages/package-form";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";

export const metadata = { title: "Add package" };

export default async function NewPackagePage() {
  await requireAction("packages.manage");
  return (
    <>
      <PageHeader title="Add a package" />
      <Card><PackageForm /></Card>
    </>
  );
}
