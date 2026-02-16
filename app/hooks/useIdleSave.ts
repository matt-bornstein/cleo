"use client";

import { useCallback, useEffect, useRef } from "react";

type UseIdleSaveArgs = {
  delayMs?: unknown;
  onIdle: unknown;
};

export function useIdleSave({ delayMs = 5000, onIdle }: UseIdleSaveArgs) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedDelayMs =
    typeof delayMs === "number" && Number.isFinite(delayMs) && delayMs >= 0
      ? delayMs
      : 5000;

  const scheduleIdleSave = useCallback(() => {
    if (timeoutRef.current) {
      safeClearTimeout(timeoutRef.current);
    }
    timeoutRef.current = safeSetTimeout(() => {
      if (typeof onIdle === "function") {
        onIdle();
      }
    }, normalizedDelayMs);
  }, [normalizedDelayMs, onIdle]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        safeClearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { scheduleIdleSave };
}

function safeSetTimeout(callback: () => void, delayMs: number) {
  try {
    return setTimeout(callback, delayMs);
  } catch {
    return null;
  }
}

function safeClearTimeout(timer: ReturnType<typeof setTimeout>) {
  try {
    clearTimeout(timer);
  } catch {
    return;
  }
}
