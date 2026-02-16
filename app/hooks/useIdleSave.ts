"use client";

import { useCallback, useEffect, useRef } from "react";

type UseIdleSaveArgs = {
  delayMs?: number;
  onIdle: () => void;
};

export function useIdleSave({ delayMs = 5000, onIdle }: UseIdleSaveArgs) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleIdleSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onIdle();
    }, delayMs);
  }, [delayMs, onIdle]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { scheduleIdleSave };
}
