"use client";

import { useEffect, useState } from "react";

type LockStatus = {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: number;
};

export function useAILockStatus(documentId: string) {
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
      if (!documentId) {
        return;
      }

      try {
        const response = await fetch(
          `/api/ai/stream?documentId=${encodeURIComponent(documentId)}`,
        );
        if (!response.ok) {
          if (isMounted) {
            setState({ documentId, status: { locked: false } });
          }
          return;
        }
        const payload = (await response.json()) as LockStatus;
        if (isMounted) {
          setState({ documentId, status: payload });
        }
      } catch {
        if (isMounted) {
          setState({ documentId, status: { locked: false } });
        }
      }
    }

    void fetchStatus();
    if (!documentId) {
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
  }, [documentId]);

  if (state.documentId !== documentId) {
    return { locked: false };
  }

  return state.status;
}
