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
import { isValidEmail } from "@/lib/validators/email";

type ShareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  ownerEmail?: string;
};

const roleOptions: Role[] = ["editor", "commenter", "viewer"];

export function ShareModal({
  open,
  onOpenChange,
  documentId,
  ownerEmail,
}: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [linkRole, setLinkRole] = useState<"editor" | "commenter" | "viewer">("viewer");
  const [version, setVersion] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  const shareableLink = useMemo(() => {
    const path = `/editor/${documentId}?share=${linkRole}`;
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [documentId, linkRole]);

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
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-700">Shareable link</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Link role</span>
              <select
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                value={linkRole}
                onChange={(event) =>
                  setLinkRole(event.target.value as "editor" | "commenter" | "viewer")
                }
              >
                <option value="viewer">viewer</option>
                <option value="commenter">commenter</option>
                <option value="editor">editor</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Input value={shareableLink} readOnly />
              <Button
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard?.writeText?.(shareableLink);
                  setCopyState("copied");
                  setTimeout(() => setCopyState("idle"), 1500);
                }}
              >
                {copyState === "copied" ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="user@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (addError) {
                  setAddError(null);
                }
              }}
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
                const normalizedEmail = email.trim().toLowerCase();
                if (!isValidEmail(normalizedEmail)) {
                  setAddError("Enter a valid email address.");
                  return;
                }

                if (ownerEmail && normalizedEmail === ownerEmail.toLowerCase()) {
                  setAddError("Owner access is fixed and cannot be re-added.");
                  return;
                }

                upsertPermission(documentId, normalizedEmail, role);
                setEmail("");
                setAddError(null);
                setVersion((value) => value + 1);
              }}
            >
              Add
            </Button>
          </div>
          {addError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
              {addError}
            </p>
          ) : null}
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
            {ownerEmail ? (
              <div className="flex items-center justify-between rounded-md bg-white px-2 py-1">
                <span className="text-xs text-slate-700">{ownerEmail} · owner</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Fixed
                </span>
              </div>
            ) : null}
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
