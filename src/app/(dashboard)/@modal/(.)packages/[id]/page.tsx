import { Modal } from "@/components/ui/modal";
import Page from "@/app/(dashboard)/packages/[id]/page";

export default async function Intercepted(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // "quotations" is a real sibling page, not a package id: do not intercept it.
  if (id === "quotations") return null;
  return <Modal title="Edit package"><Page {...props} /></Modal>;
}
