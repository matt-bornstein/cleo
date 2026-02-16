"use client";

import { Button } from "@/components/ui/button";

type ToolbarProps = {
  documentTitle: string;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onHistory: () => void;
  onExport: () => void;
  onShare: () => void;
  onSettings: () => void;
};

export function Toolbar({
  documentTitle,
  onNewDocument,
  onOpenDocument,
  onHistory,
  onExport,
  onShare,
  onSettings,
}: ToolbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onNewDocument}>
          New
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenDocument}>
          Open
        </Button>
        <Button variant="outline" size="sm" onClick={onHistory}>
          History
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={onShare}>
          Share
        </Button>
        <Button variant="outline" size="sm" onClick={onSettings}>
          Settings
        </Button>
      </div>
      <div className="max-w-[300px] truncate text-sm font-semibold text-slate-700">
        {documentTitle}
      </div>
    </header>
  );
}
