"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ShareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShareModal({ open, onOpenChange }: ShareModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Permission management will be implemented in Phase 4.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-slate-600">
          <p>Collaborators and role controls are not active yet.</p>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
