"use client";

import { FormEvent, useState } from "react";

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

type NewDocModalProps = {
  open: unknown;
  onOpenChange: unknown;
  onCreateDocument: unknown;
};

export function NewDocModal({
  open,
  onOpenChange,
  onCreateDocument,
}: NewDocModalProps) {
  const normalizedOpen = open === true;
  const [title, setTitle] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typeof onCreateDocument === "function") {
      onCreateDocument(title);
    }
    setTitle("");
    if (typeof onOpenChange === "function") {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={normalizedOpen}
      onOpenChange={(nextOpen) => {
        if (typeof onOpenChange === "function") {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new document</DialogTitle>
          <DialogDescription>
            Start with a blank rich text document.
          </DialogDescription>
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
                if (typeof onOpenChange === "function") {
                  onOpenChange(false);
                }
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
