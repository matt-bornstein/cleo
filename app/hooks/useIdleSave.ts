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
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (typeof onIdle === "function") {
        onIdle();
      }
    }, normalizedDelayMs);
  }, [normalizedDelayMs, onIdle]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { scheduleIdleSave };
}
