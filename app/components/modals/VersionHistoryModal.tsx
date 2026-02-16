"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listDiffsByDocument } from "@/lib/diffs/store";

type VersionHistoryModalProps = {
  open: unknown;
  onOpenChange: unknown;
  documentId: unknown;
  onRestoreSnapshot: unknown;
};

export function VersionHistoryModal({
  open,
  onOpenChange,
  documentId,
  onRestoreSnapshot,
}: VersionHistoryModalProps) {
  const normalizedOpen = open === true;
  const [selectedDiffId, setSelectedDiffId] = useState<string | null>(null);
  const diffs = useMemo(() => listDiffsByDocument(documentId), [documentId]);
  const selectedDiff = diffs.find((diff) => diff.id === selectedDiffId) ?? diffs[0];

  return (
    <Dialog
      open={normalizedOpen}
      onOpenChange={(nextOpen) => {
        if (typeof onOpenChange === "function") {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Review and restore prior snapshots from manual or AI saves.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
          <div className="max-h-96 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
            {diffs.map((diff) => (
              <button
                key={diff.id}
                type="button"
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-left text-xs hover:bg-slate-100"
                onClick={() => setSelectedDiffId(diff.id)}
              >
                <div className="font-medium text-slate-700">{diff.source}</div>
                <div className="text-slate-500">
                  {new Date(diff.createdAt).toLocaleString()}
                </div>
              </button>
            ))}
            {diffs.length === 0 ? (
              <p className="px-2 py-4 text-xs text-slate-500">No versions saved yet.</p>
            ) : null}
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <h4 className="mb-2 text-sm font-medium text-slate-700">Snapshot preview</h4>
            <pre className="max-h-80 overflow-auto rounded-md bg-slate-900 p-2 text-[11px] text-slate-100">
              {selectedDiff?.snapshotAfter ?? "No snapshot selected"}
            </pre>
            <div className="mt-2 flex justify-end">
              <Button
                disabled={!selectedDiff}
                onClick={() => {
                  if (!selectedDiff) return;
                  if (typeof onRestoreSnapshot === "function") {
                    onRestoreSnapshot(selectedDiff.snapshotAfter);
                  }
                  if (typeof onOpenChange === "function") {
                    onOpenChange(false);
                  }
                }}
              >
                Restore selected version
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
