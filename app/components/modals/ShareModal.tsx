"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizeDocumentId } from "@/lib/ai/documentId";
import { sanitizeShareRole } from "@/lib/permissions/shareLink";
import {
  listPermissions,
  removePermission,
  upsertPermission,
} from "@/lib/permissions/store";
import type { Role } from "@/lib/types";
import { normalizeEmailOrUndefined } from "@/lib/user/email";
import { isValidEmail } from "@/lib/validators/email";

type ShareModalProps = {
  open: unknown;
  onOpenChange: unknown;
  documentId: unknown;
  ownerEmail?: unknown;
};

const roleOptions: Role[] = ["editor", "commenter", "viewer"];

export function ShareModal({
  open,
  onOpenChange,
  documentId,
  ownerEmail,
}: ShareModalProps) {
  const normalizedOpen = open === true;
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const normalizedOwnerEmail = normalizeEmailOrUndefined(ownerEmail);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [linkRole, setLinkRole] = useState<"editor" | "commenter" | "viewer">("viewer");
  const [version, setVersion] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shareableLink = useMemo(() => {
    const path = `/editor/${normalizedDocumentId}?share=${linkRole}`;
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [linkRole, normalizedDocumentId]);

  const permissions = useMemo(() => {
    void version;
    return listPermissions(normalizedDocumentId);
  }, [normalizedDocumentId, version]);
  const isAddDisabled = email.trim().length === 0;

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const resetTransientState = useCallback(() => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    setRole("editor");
    setLinkRole("viewer");
    setEmail("");
    setAddError(null);
    setCopyState("idle");
  }, []);

  const scheduleCopyStateReset = useCallback((delayMs = 1500) => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      setCopyState("idle");
      copyTimeoutRef.current = null;
    }, delayMs);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetTransientState();
      }
      if (typeof onOpenChange === "function") {
        onOpenChange(nextOpen);
      }
    },
    [onOpenChange, resetTransientState],
  );

  return (
    <Dialog open={normalizedOpen} onOpenChange={handleOpenChange}>
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
                onChange={(event) => {
                  const nextRole = sanitizeShareRole(event.target.value);
                  if (
                    nextRole === "editor" ||
                    nextRole === "commenter" ||
                    nextRole === "viewer"
                  ) {
                    setLinkRole(nextRole);
                  }
                  if (copyState !== "idle") {
                    setCopyState("idle");
                  }
                }}
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
                  try {
                    if (!navigator.clipboard?.writeText) {
                      throw new Error("Clipboard API unavailable");
                    }
                    await navigator.clipboard.writeText(shareableLink);
                    setCopyState("copied");
                  } catch {
                    setCopyState("error");
                  }
                  scheduleCopyStateReset();
                }}
              >
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "error"
                    ? "Copy failed"
                    : "Copy link"}
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
              onChange={(event) => {
                const nextRole = sanitizeShareRole(event.target.value);
                setRole(
                  nextRole === "editor" ||
                    nextRole === "commenter" ||
                    nextRole === "viewer"
                    ? nextRole
                    : "editor",
                );
              }}
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button
              disabled={isAddDisabled}
              onClick={() => {
                const normalizedEmail = normalizeEmailOrUndefined(email);
                if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
                  setAddError("Enter a valid email address.");
                  return;
                }

                if (normalizedOwnerEmail && normalizedEmail === normalizedOwnerEmail) {
                  setAddError("Owner access is fixed and cannot be re-added.");
                  return;
                }

                const existing = permissions.find(
                  (permission) => permission.email === normalizedEmail,
                );
                const upserted = upsertPermission(
                  normalizedDocumentId,
                  normalizedEmail,
                  role,
                );
                if (!upserted) {
                  setAddError("Unable to add collaborator.");
                  return;
                }

                setEmail("");
                setAddError(null);
                if (!existing || existing.role !== role) {
                  setVersion((value) => value + 1);
                }
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
            {normalizedOwnerEmail ? (
              <div className="flex items-center justify-between rounded-md bg-white px-2 py-1">
                <span className="text-xs text-slate-700">
                  {normalizedOwnerEmail} · owner
                </span>
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
                    const confirmed = window.confirm(
                      `Remove ${permission.email} from this document?`,
                    );
                    if (!confirmed) return;
                    const removed = removePermission(permission.id);
                    if (removed) {
                      setVersion((value) => value + 1);
                    }
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
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
