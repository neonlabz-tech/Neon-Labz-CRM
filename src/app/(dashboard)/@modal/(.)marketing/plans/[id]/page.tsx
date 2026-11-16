import { Modal } from "@/components/ui/modal";
import Page from "@/app/(dashboard)/marketing/plans/[id]/page";

export default function Intercepted(props: { params: Promise<{ id: string }> }) {
  return <Modal title="Content plan"><Page {...props} /></Modal>;
}
