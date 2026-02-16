"use client";

import { useEffect, useState } from "react";

import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { hasControlChars } from "@/lib/validators/controlChars";

type LockStatus = {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: number;
};

export function useAILockStatus(documentId: unknown) {
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
        if (!isSuccessfulResponse(response)) {
          if (isMounted) {
            setState({ documentId: normalizedDocumentId, status: { locked: false } });
          }
          return;
        }
        const payload = normalizeLockStatus(await readResponseJson(response));
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

    intervalId = safeSetInterval(() => {
      void fetchStatus();
    }, 2000);

    return () => {
      isMounted = false;
      if (intervalId) {
        safeClearInterval(intervalId);
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

  const locked = readLockPayloadField(value, "locked");
  if (locked !== true) {
    return { locked: false };
  }

  const lockedBy = readLockPayloadField(value, "lockedBy");
  const lockedAt = readLockPayloadField(value, "lockedAt");
  const normalizedLockedBy =
    typeof lockedBy === "string" &&
    lockedBy.trim().length > 0 &&
    lockedBy.trim().length <= MAX_USER_ID_LENGTH &&
    !hasControlChars(lockedBy.trim())
      ? lockedBy.trim()
      : undefined;
  const normalizedLockedAt =
    typeof lockedAt === "number" &&
    Number.isFinite(lockedAt) &&
    lockedAt >= 0
      ? lockedAt
      : undefined;

  return {
    locked: true,
    lockedBy: normalizedLockedBy,
    lockedAt: normalizedLockedAt,
  };
}

function isSuccessfulResponse(response: unknown) {
  if (!response || typeof response !== "object" || !("ok" in response)) {
    return false;
  }

  try {
    return (response as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}

async function readResponseJson(response: unknown) {
  if (!response || typeof response !== "object" || !("json" in response)) {
    return null;
  }

  let jsonFn: unknown;
  try {
    jsonFn = (response as { json?: unknown }).json;
  } catch {
    return null;
  }
  if (typeof jsonFn !== "function") {
    return null;
  }

  try {
    return await Reflect.apply(jsonFn, response, []);
  } catch {
    return null;
  }
}

function safeSetInterval(callback: () => void, intervalMs: number) {
  try {
    return setInterval(callback, intervalMs);
  } catch {
    return null;
  }
}

function safeClearInterval(intervalId: ReturnType<typeof setInterval>) {
  try {
    clearInterval(intervalId);
  } catch {
    return;
  }
}

function readLockPayloadField(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  try {
    return (payload as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}
