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
import { Input } from "@/components/ui/input";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import type { AppDocument } from "@/lib/types";
import { hasControlChars } from "@/lib/validators/controlChars";

type OpenDocModalProps = {
  open: unknown;
  onOpenChange: unknown;
  documents: unknown;
  onOpenDocument: unknown;
  onDeleteDocument: unknown;
};

export function OpenDocModal({
  open,
  onOpenChange,
  documents,
  onOpenDocument,
  onDeleteDocument,
}: OpenDocModalProps) {
  const normalizedOpen = open === true;
  const normalizedDocuments = useMemo(() => {
    if (!Array.isArray(documents)) {
      return [] as AppDocument[];
    }

    return documents.flatMap((document) => {
      if (!document || typeof document !== "object") {
        return [];
      }
      const candidate = document as Partial<AppDocument>;
      const normalizedDocumentId = normalizeDocumentId(candidate.id);
      if (!isValidDocumentId(normalizedDocumentId)) {
        return [];
      }

      const normalizedTitle =
        typeof candidate.title === "string" &&
        candidate.title.trim().length > 0 &&
        !hasControlChars(candidate.title.trim())
          ? candidate.title.trim()
          : "Untitled";
      const normalizedUpdatedAt =
        typeof candidate.updatedAt === "number" &&
        Number.isFinite(candidate.updatedAt) &&
        candidate.updatedAt >= 0
          ? candidate.updatedAt
          : 0;

      return [
        {
          id: normalizedDocumentId,
          title: normalizedTitle,
          content: typeof candidate.content === "string" ? candidate.content : "{}",
          createdAt:
            typeof candidate.createdAt === "number" &&
            Number.isFinite(candidate.createdAt) &&
            candidate.createdAt >= 0
              ? candidate.createdAt
              : normalizedUpdatedAt,
          updatedAt: normalizedUpdatedAt,
          ownerEmail:
            typeof candidate.ownerEmail === "string" ? candidate.ownerEmail : undefined,
        },
      ];
    });
  }, [documents]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return normalizedDocuments;
    return normalizedDocuments.filter((doc) =>
      doc.title.toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedDocuments, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  const paginatedDocuments = filteredDocuments.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  return (
    <Dialog
      open={normalizedOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setPage(1);
        }
        safeOnOpenChange(onOpenChange, nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open document</DialogTitle>
          <DialogDescription>
            Search and open a recently edited document.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search by title"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {paginatedDocuments.map((document) => (
              <div
                key={document.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-sm hover:text-blue-700"
                  onClick={() => {
                    safeOnOpenDocument(onOpenDocument, document.id);
                    safeOnOpenChange(onOpenChange, false);
                  }}
                >
                  <div className="truncate font-medium text-slate-700">{document.title}</div>
                  <div className="text-xs text-slate-500">
                    Updated {new Date(document.updatedAt).toLocaleString()}
                  </div>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const confirmed = safeConfirm(
                      `Delete "${document.title}"? This action cannot be undone.`,
                    );
                    if (!confirmed) return;
                    safeOnDeleteDocument(onDeleteDocument, document.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
            {filteredDocuments.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                No documents found.
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                safeOnOpenChange(onOpenChange, false);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function safeConfirm(message: string) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return false;
  }

  try {
    return window.confirm(message);
  } catch {
    return false;
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

function safeOnOpenDocument(onOpenDocument: unknown, documentId: string) {
  if (typeof onOpenDocument !== "function") {
    return;
  }

  try {
    onOpenDocument(documentId);
  } catch {
    return;
  }
}

function safeOnDeleteDocument(onDeleteDocument: unknown, documentId: string) {
  if (typeof onDeleteDocument !== "function") {
    return;
  }

  try {
    onDeleteDocument(documentId);
  } catch {
    return;
  }
}
