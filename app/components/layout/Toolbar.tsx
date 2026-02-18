"use client";

import { Button } from "@/components/ui/button";
import { hasControlChars } from "@/lib/validators/controlChars";

type ToolbarProps = {
  documentTitle: unknown;
  roleLabel?: unknown;
  commentsVisible?: unknown;
  onRenameDocument: unknown;
  onNewDocument: unknown;
  onOpenDocument: unknown;
  onToggleComments: unknown;
  onHistory: unknown;
  onExport: unknown;
  onShare: unknown;
  onSettings: unknown;
  canShare?: unknown;
};

export function Toolbar({
  documentTitle,
  roleLabel,
  commentsVisible = false,
  onRenameDocument,
  onNewDocument,
  onOpenDocument,
  onToggleComments,
  onHistory,
  onExport,
  onShare,
  onSettings,
  canShare = true,
}: ToolbarProps) {
  const normalizedDocumentTitle =
    typeof documentTitle === "string" && documentTitle.trim().length > 0
      ? documentTitle.trim()
      : "Untitled";
  const normalizedRoleLabel =
    typeof roleLabel === "string" &&
    roleLabel.trim().length > 0 &&
    !hasControlChars(roleLabel.trim())
      ? roleLabel.trim()
      : undefined;
  const normalizedCanShare = canShare !== false;
  const normalizedCommentsVisible = commentsVisible === true;
  const commentsButtonLabel = normalizedCommentsVisible ? "Hide comments" : "Show comments";

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            safeInvoke(onNewDocument);
          }}
        >
          New
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            safeInvoke(onOpenDocument);
          }}
        >
          Open
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            safeInvoke(onRenameDocument);
          }}
        >
          Rename
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            safeInvoke(onToggleComments);
          }}
        >
          {commentsButtonLabel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            safeInvoke(onHistory);
          }}
        >
          History
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            safeInvoke(onExport);
          }}
        >
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            safeInvoke(onShare);
          }}
          disabled={!normalizedCanShare}
        >
          Share
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            safeInvoke(onSettings);
          }}
        >
          Settings
        </Button>
      </div>
      <div className="max-w-[300px] truncate text-sm font-semibold text-slate-700">
        {normalizedDocumentTitle}
      </div>
      <div className="hidden items-center gap-2 text-xs text-slate-600 sm:flex">
        {normalizedRoleLabel ? (
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 uppercase tracking-wide">
            {normalizedRoleLabel}
          </span>
        ) : null}
      </div>
    </header>
  );
}

function safeInvoke(callback: unknown, ...args: unknown[]) {
  if (typeof callback !== "function") {
    return;
  }

  try {
    callback(...args);
  } catch {
    return;
  }
}
