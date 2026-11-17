"use client";

import { Download, Eye, FileText, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { useToast } from "@/components/ui/toast";
import { downloadPdf } from "@/lib/pdf/download-client";

/** Preview opens the report in a window; PDF saves it to the browser's downloads folder. The id is `report~from~to`. */
export function ReportActions({ id, title }: { id: string; title: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const htmlUrl = `/api/pdf/company/${encodeURIComponent(id)}?format=html`;

  async function download() {
    setBusy(true);
    try {
      await downloadPdf(htmlUrl, `${title.replace(/\s+/g, "-")}-${id.split("~").slice(1).join("-to-")}`);
    } catch (error) {
      toast(false, error instanceof Error ? error.message : "Could not make the PDF.");
    } finally {
      setBusy(false);
    }
  }

  const pdfButton = (
    <Button onClick={download} disabled={busy} size="sm" className="w-full">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}PDF
    </Button>
  );

  return (
    <>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <Button variant="outline" size="sm" onClick={() => { setOpen(true); ref.current?.showModal(); }}><Eye className="h-4 w-4" />Preview</Button>
        {pdfButton}
      </div>
      <DialogShell
        dialogRef={ref}
        title={title}
        icon={<FileText className="h-5 w-5" />}
        onLeave={() => { ref.current?.close(); setOpen(false); }}
        closeButton
        footerExtra={<Button onClick={download} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download PDF</Button>}
        className="h-[92vh] w-[min(62rem,calc(100vw-1rem))]"
      >
        {open && <iframe src={htmlUrl} title={title} className="h-[70vh] w-full rounded-xl border border-line bg-canvas max-sm:h-[62vh]" />}
      </DialogShell>
    </>
  );
}
