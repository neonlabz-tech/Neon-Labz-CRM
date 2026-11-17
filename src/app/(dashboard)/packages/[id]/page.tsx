import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { PackageForm } from "@/components/packages/package-form";
import { Card, PageHeader } from "@/components/ui/card";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Package } from "@/models/package";

export const metadata = { title: "Edit package" };

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAction("packages.manage");
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await connectDb();
  const pkg = await Package.findById(id).lean();
  if (!pkg) notFound();
  return (
    <>
      <PageHeader title="Edit package" subtitle={pkg.name} />
      <Card><PackageForm defaults={{ id, name: pkg.name, category: pkg.category, description: pkg.description, price: pkg.price, duration: pkg.duration, features: pkg.features, status: pkg.status, cover: pkg.cover, icon: pkg.icon }} /></Card>
    </>
  );
}
