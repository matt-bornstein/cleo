"use client";

import { Button } from "@/components/ui/button";

type ToolbarProps = {
  documentTitle: string;
  roleLabel?: string;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onHistory: () => void;
  onExport: () => void;
  onShare: () => void;
  onSettings: () => void;
  canShare?: boolean;
};

export function Toolbar({
  documentTitle,
  roleLabel,
  onNewDocument,
  onOpenDocument,
  onHistory,
  onExport,
  onShare,
  onSettings,
  canShare = true,
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
        <Button variant="outline" size="sm" onClick={onShare} disabled={!canShare}>
          Share
        </Button>
        <Button variant="outline" size="sm" onClick={onSettings}>
          Settings
        </Button>
      </div>
      <div className="max-w-[300px] truncate text-sm font-semibold text-slate-700">
        {documentTitle}
      </div>
      <div className="hidden items-center gap-2 text-xs text-slate-600 sm:flex">
        {roleLabel ? (
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 uppercase tracking-wide">
            {roleLabel}
          </span>
        ) : null}
      </div>
    </header>
  );
}
