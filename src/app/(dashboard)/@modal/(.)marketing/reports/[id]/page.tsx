import { Modal } from "@/components/ui/modal";
import Page from "@/app/(dashboard)/marketing/reports/[id]/page";

export default function Intercepted(props: { params: Promise<{ id: string }> }) {
  return <Modal title="Marketing report"><Page {...props} /></Modal>;
}
