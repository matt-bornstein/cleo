"use client";

import { useEffect, useState } from "react";

type LockStatus = {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: number;
};

export function useAILockStatus(documentId: string) {
  const [status, setStatus] = useState<LockStatus>({ locked: false });

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function fetchStatus() {
      try {
        const response = await fetch(
          `/api/ai/stream?documentId=${encodeURIComponent(documentId)}`,
        );
        if (!response.ok) return;
        const payload = (await response.json()) as LockStatus;
        if (isMounted) {
          setStatus(payload);
        }
      } catch {
        if (isMounted) {
          setStatus({ locked: false });
        }
      }
    }

    void fetchStatus();
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

  return status;
}
