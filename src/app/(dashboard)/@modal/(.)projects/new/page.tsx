import { Modal } from "@/components/ui/modal";
import Page from "@/app/(dashboard)/projects/new/page";

export default function Intercepted(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Modal title="New project"><Page {...props} /></Modal>;
}
