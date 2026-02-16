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
  const diffs = useMemo(
    () =>
      safeListDiffsByDocument(documentId).flatMap((diff, index) => {
        const normalizedDiff = normalizeDiffEntry(diff, index);
        return normalizedDiff ? [normalizedDiff] : [];
      }),
    [documentId],
  );
  const selectedDiff = diffs.find((diff) => diff.id === selectedDiffId) ?? diffs[0];

  return (
    <Dialog
      open={normalizedOpen}
      onOpenChange={(nextOpen) => {
        safeOnOpenChange(onOpenChange, nextOpen);
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
                  safeOnRestoreSnapshot(
                    onRestoreSnapshot,
                    selectedDiff.snapshotAfter,
                  );
                  safeOnOpenChange(onOpenChange, false);
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

function safeListDiffsByDocument(documentId: unknown) {
  try {
    return listDiffsByDocument(documentId);
  } catch {
    return [];
  }
}

function normalizeDiffEntry(diff: unknown, index: number) {
  if (!diff || typeof diff !== "object") {
    return undefined;
  }

  const id = readDiffField(diff, "id");
  const source = readDiffField(diff, "source");
  const createdAt = readDiffField(diff, "createdAt");
  const snapshotAfter = readDiffField(diff, "snapshotAfter");

  return {
    id:
      typeof id === "string" && id.trim().length > 0
        ? id.trim()
        : `diff-${index}`,
    source:
      typeof source === "string" && source.trim().length > 0
        ? source.trim()
        : "manual",
    createdAt:
      typeof createdAt === "number" && Number.isFinite(createdAt) && createdAt >= 0
        ? createdAt
        : 0,
    snapshotAfter:
      typeof snapshotAfter === "string"
        ? snapshotAfter
        : "No snapshot available",
  };
}

function readDiffField(diff: unknown, key: "id" | "source" | "createdAt" | "snapshotAfter") {
  if (!diff || typeof diff !== "object") {
    return undefined;
  }

  try {
    return (diff as Record<string, unknown>)[key];
  } catch {
    return undefined;
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

function safeOnRestoreSnapshot(onRestoreSnapshot: unknown, snapshot: string) {
  if (typeof onRestoreSnapshot !== "function") {
    return;
  }

  try {
    onRestoreSnapshot(snapshot);
  } catch {
    return;
  }
}
