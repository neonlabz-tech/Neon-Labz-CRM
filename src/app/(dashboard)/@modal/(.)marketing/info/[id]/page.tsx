import { Modal } from "@/components/ui/modal";
import Page from "@/app/(dashboard)/marketing/info/[id]/page";

export default function Intercepted(props: { params: Promise<{ id: string }> }) {
  return <Modal title="Client info"><Page {...props} /></Modal>;
}
