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
              exportPdfSafely(content);
            }}
          >
            PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function exportPdfSafely(content: unknown) {
  const printWindow = openPrintWindowSafely();
  if (!printWindow) {
    return;
  }

  const html = readExportHtmlSafely(content);
  if (typeof html !== "string") {
    return;
  }

  writePrintWindowDocumentSafely(printWindow, html);
  closePrintWindowDocumentSafely(printWindow);
  focusPrintWindowSafely(printWindow);
  triggerPrintSafely(printWindow);
}

function openPrintWindowSafely() {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return null;
  }

  try {
    return window.open("", "_blank", "noopener,noreferrer");
  } catch {
    return null;
  }
}

function readExportHtmlSafely(content: unknown) {
  try {
    return exportHtml(content);
  } catch {
    return undefined;
  }
}

function writePrintWindowDocumentSafely(printWindow: Window, html: string) {
  try {
    if (
      printWindow.document &&
      typeof printWindow.document.write === "function"
    ) {
      printWindow.document.write(html);
    }
  } catch {
    return;
  }
}

function closePrintWindowDocumentSafely(printWindow: Window) {
  try {
    if (
      printWindow.document &&
      typeof printWindow.document.close === "function"
    ) {
      printWindow.document.close();
    }
  } catch {
    return;
  }
}

function focusPrintWindowSafely(printWindow: Window) {
  try {
    if (typeof printWindow.focus === "function") {
      printWindow.focus();
    }
  } catch {
    return;
  }
}

function triggerPrintSafely(printWindow: Window) {
  try {
    if (typeof printWindow.print === "function") {
      printWindow.print();
    }
  } catch {
    return;
  }
}
