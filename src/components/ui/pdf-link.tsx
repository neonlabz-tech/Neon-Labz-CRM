"use client";

import { Download, FileText, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { iconButton } from "@/components/ui/icon-link";
import { useToast } from "@/components/ui/toast";
import { downloadPdf } from "@/lib/pdf/download-client";

/**
 * Opens the document in a window, exactly as it will print. "Download PDF" saves it to the browser's downloads folder.
 * The page is only loaded when the window is opened.
 */
export function PdfLink({ kind, id, label = "PDF" }: { kind: string; id: string; label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const htmlUrl = `/api/pdf/${kind}/${encodeURIComponent(id)}?format=html`;

  async function download() {
    setBusy(true);
    try {
      await downloadPdf(htmlUrl, `${kind}-${id}`);
    } catch (error) {
      toast(false, error instanceof Error ? error.message : "Could not make the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" title={label} aria-label={label} className={iconButton} onClick={() => { setOpen(true); ref.current?.showModal(); }}>
        <FileText />
      </button>
      <DialogShell
        dialogRef={ref}
        title="Document preview"
        icon={<FileText className="h-5 w-5" />}
        onLeave={() => { ref.current?.close(); setOpen(false); }}
        closeButton
        footerExtra={
          <Button onClick={download} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
        }
        className="h-[92vh] w-[min(62rem,calc(100vw-1rem))]"
      >
        {open && <iframe src={htmlUrl} title="Document preview" className="h-[70vh] w-full rounded-xl border border-line bg-canvas max-sm:h-[62vh]" />}
      </DialogShell>
    </>
  );
}
