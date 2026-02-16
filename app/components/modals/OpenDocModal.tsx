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
};

export function OpenDocModal({
  open,
  onOpenChange,
  documents,
  onOpenDocument,
}: OpenDocModalProps) {
  const [search, setSearch] = useState("");

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return documents;
    return documents.filter((doc) =>
      doc.title.toLowerCase().includes(normalizedSearch),
    );
  }, [documents, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {filteredDocuments.map((document) => (
              <button
                key={document.id}
                type="button"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onOpenDocument(document.id);
                  onOpenChange(false);
                }}
              >
                <div className="font-medium text-slate-700">{document.title}</div>
                <div className="text-xs text-slate-500">
                  Updated {new Date(document.updatedAt).toLocaleString()}
                </div>
              </button>
            ))}
            {filteredDocuments.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                No documents found.
              </div>
            ) : null}
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
