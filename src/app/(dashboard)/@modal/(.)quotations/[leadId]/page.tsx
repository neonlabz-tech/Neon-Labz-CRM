import { Modal } from "@/components/ui/modal";
import Page from "@/app/(dashboard)/quotations/[leadId]/page";

export default function Intercepted(props: { params: Promise<{ leadId: string }> }) {
  return <Modal title="Quotation"><Page {...props} /></Modal>;
}
