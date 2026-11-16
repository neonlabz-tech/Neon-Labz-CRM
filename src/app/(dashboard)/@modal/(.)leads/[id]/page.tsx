import { Modal } from "@/components/ui/modal";
import Page from "@/app/(dashboard)/leads/[id]/page";

export default async function Intercepted(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <Modal title="Edit lead" subtitle={id}><Page {...props} /></Modal>;
}
