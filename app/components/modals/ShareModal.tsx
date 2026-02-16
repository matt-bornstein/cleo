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
import {
  listPermissions,
  removePermission,
  upsertPermission,
} from "@/lib/permissions/store";
import type { Role } from "@/lib/types";

type ShareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
};

const roleOptions: Role[] = ["editor", "commenter", "viewer"];

export function ShareModal({ open, onOpenChange, documentId }: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [version, setVersion] = useState(0);

  const permissions = useMemo(() => {
    void version;
    return listPermissions(documentId);
  }, [documentId, version]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Add collaborators by email and assign permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex gap-2">
            <Input
              placeholder="user@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button
              onClick={() => {
                if (!email.trim()) return;
                upsertPermission(documentId, email, role);
                setEmail("");
                setVersion((value) => value + 1);
              }}
            >
              Add
            </Button>
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
            {permissions.map((permission) => (
              <div
                key={permission.id}
                className="flex items-center justify-between rounded-md bg-white px-2 py-1"
              >
                <span className="text-xs text-slate-700">
                  {permission.email} · {permission.role}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    removePermission(permission.id);
                    setVersion((value) => value + 1);
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            {permissions.length === 0 ? (
              <p className="px-1 py-2 text-xs text-slate-500">
                No collaborators yet.
              </p>
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
