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
import type { AppDocument } from "@/lib/types";

type OpenDocModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: AppDocument[];
  onOpenDocument: (documentId: string) => void;
  onDeleteDocument: (documentId: string) => void;
};

export function OpenDocModal({
  open,
  onOpenChange,
  documents,
  onOpenDocument,
  onDeleteDocument,
}: OpenDocModalProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return documents;
    return documents.filter((doc) =>
      doc.title.toLowerCase().includes(normalizedSearch),
    );
  }, [documents, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  const paginatedDocuments = filteredDocuments.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setPage(1);
        }
        onOpenChange(nextOpen);
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
                    onOpenDocument(document.id);
                    onOpenChange(false);
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
                  onClick={() => onDeleteDocument(document.id)}
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
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
