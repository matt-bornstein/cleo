"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadFile, exportHtml, exportMarkdown } from "@/lib/export";

type ExportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  content: string;
};

export function ExportModal({
  open,
  onOpenChange,
  documentTitle,
  content,
}: ExportModalProps) {
  const safeTitle = documentTitle.replace(/\s+/g, "-").toLowerCase() || "untitled";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export document</DialogTitle>
          <DialogDescription>
            Download your document as Markdown, HTML, or PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            onClick={() =>
              downloadFile(
                exportMarkdown(content),
                `${safeTitle}.md`,
                "text/markdown;charset=utf-8",
              )
            }
          >
            Markdown
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadFile(
                exportHtml(content),
                `${safeTitle}.html`,
                "text/html;charset=utf-8",
              )
            }
          >
            HTML
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const printWindow = window.open("", "_blank", "noopener,noreferrer");
              if (!printWindow) return;
              printWindow.document.write(exportHtml(content));
              printWindow.document.close();
              printWindow.focus();
              printWindow.print();
            }}
          >
            PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
