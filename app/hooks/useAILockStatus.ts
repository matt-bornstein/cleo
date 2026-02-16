"use client";

import { useEffect, useState } from "react";

import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { hasControlChars } from "@/lib/validators/controlChars";

type LockStatus = {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: number;
};

export function useAILockStatus(documentId: string) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const hasValidDocumentId = isValidDocumentId(normalizedDocumentId);
  const [state, setState] = useState<{
    documentId: string;
    status: LockStatus;
  }>({
    documentId: "",
    status: { locked: false },
  });

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function fetchStatus() {
      if (!hasValidDocumentId) {
        return;
      }

      try {
        const response = await fetch(
          `/api/ai/stream?documentId=${encodeURIComponent(normalizedDocumentId)}`,
        );
        if (!response.ok) {
          if (isMounted) {
            setState({ documentId: normalizedDocumentId, status: { locked: false } });
          }
          return;
        }
        const payload = normalizeLockStatus(await response.json());
        if (isMounted) {
          setState({ documentId: normalizedDocumentId, status: payload });
        }
      } catch {
        if (isMounted) {
          setState({ documentId: normalizedDocumentId, status: { locked: false } });
        }
      }
    }

    void fetchStatus();
    if (!hasValidDocumentId) {
      return () => {
        isMounted = false;
      };
    }

    intervalId = setInterval(() => {
      void fetchStatus();
    }, 2000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [hasValidDocumentId, normalizedDocumentId]);

  if (state.documentId !== normalizedDocumentId) {
    return { locked: false };
  }

  return state.status;
}

function normalizeLockStatus(value: unknown): LockStatus {
  if (!value || typeof value !== "object") {
    return { locked: false };
  }

  const candidate = value as {
    locked?: unknown;
    lockedBy?: unknown;
    lockedAt?: unknown;
  };
  if (candidate.locked !== true) {
    return { locked: false };
  }

  const normalizedLockedBy =
    typeof candidate.lockedBy === "string" &&
    candidate.lockedBy.trim().length > 0 &&
    !hasControlChars(candidate.lockedBy.trim())
      ? candidate.lockedBy.trim()
      : undefined;
  const normalizedLockedAt =
    typeof candidate.lockedAt === "number" &&
    Number.isFinite(candidate.lockedAt) &&
    candidate.lockedAt >= 0
      ? candidate.lockedAt
      : undefined;

  return {
    locked: true,
    lockedBy: normalizedLockedBy,
    lockedAt: normalizedLockedAt,
  };
}
