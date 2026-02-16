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
  open: unknown;
  onOpenChange: unknown;
  documentTitle: unknown;
  content: unknown;
};

function toSafeTitle(documentTitle: unknown) {
  const normalizedTitle =
    typeof documentTitle === "string" ? documentTitle : "";
  const normalized = normalizedTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "untitled";
}

export function ExportModal({
  open,
  onOpenChange,
  documentTitle,
  content,
}: ExportModalProps) {
  const safeTitle = toSafeTitle(documentTitle);
  const normalizedOpen = open === true;

  return (
    <Dialog
      open={normalizedOpen}
      onOpenChange={(nextOpen) => {
        if (typeof onOpenChange === "function") {
          onOpenChange(nextOpen);
        }
      }}
    >
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
