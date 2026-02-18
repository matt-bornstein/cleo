"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type RenameDocModalProps = {
  open: unknown;
  onOpenChange: unknown;
  documentTitle: unknown;
  onRenameDocument: unknown;
};

export function RenameDocModal({
  open,
  onOpenChange,
  documentTitle,
  onRenameDocument,
}: RenameDocModalProps) {
  const normalizedOpen = open === true;
  const normalizedDocumentTitle =
    typeof documentTitle === "string" && documentTitle.trim().length > 0
      ? documentTitle.trim()
      : "Untitled";
  const [title, setTitle] = useState(normalizedDocumentTitle);

  useEffect(() => {
    if (!normalizedOpen) {
      return;
    }
    setTitle(normalizedDocumentTitle);
  }, [normalizedDocumentTitle, normalizedOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    safeRenameDocument(onRenameDocument, title);
    safeOnOpenChange(onOpenChange, false);
  };

  return (
    <Dialog
      open={normalizedOpen}
      onOpenChange={(nextOpen) => {
        safeOnOpenChange(onOpenChange, nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename document</DialogTitle>
          <DialogDescription>Choose a new document title.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            autoFocus
            placeholder="Untitled document"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                safeOnOpenChange(onOpenChange, false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
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

function safeRenameDocument(onRenameDocument: unknown, title: string) {
  if (typeof onRenameDocument !== "function") {
    return;
  }

  try {
    onRenameDocument(title);
  } catch {
    return;
  }
}
