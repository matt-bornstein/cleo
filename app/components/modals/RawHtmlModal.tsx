"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportHtml } from "@/lib/export";

type RawHtmlModalProps = {
  open: unknown;
  onOpenChange: unknown;
  content: unknown;
};

export function RawHtmlModal({ open, onOpenChange, content }: RawHtmlModalProps) {
  const normalizedOpen = open === true;
  const html = safeExportHtml(content);

  return (
    <Dialog
      open={normalizedOpen}
      onOpenChange={(nextOpen) => {
        safeOnOpenChange(onOpenChange, nextOpen);
      }}
    >
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Raw document HTML</DialogTitle>
          <DialogDescription>
            Current HTML generated from the editor document state.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
          <pre className="whitespace-pre-wrap break-words text-xs text-slate-700">
            {html}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function safeExportHtml(content: unknown) {
  try {
    return exportHtml(content);
  } catch {
    return "<p></p>";
  }
}

function safeOnOpenChange(onOpenChange: unknown, nextOpen: boolean) {
  if (typeof onOpenChange !== "function") {
    return;
  }

  try {
    onOpenChange(nextOpen);
  } catch {
    return;
  }
}
