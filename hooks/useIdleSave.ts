"use client";

import { useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const IDLE_TIMEOUT = 5000; // 5 seconds

export function useIdleSave(documentId: Id<"documents">) {
  const triggerIdleSave = useMutation(api.diffs.triggerIdleSave);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<string | null>(null);

  const scheduleIdleSave = useCallback(
    (content: string) => {
      latestContentRef.current = content;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        if (latestContentRef.current) {
          triggerIdleSave({
            documentId,
            content: latestContentRef.current,
          }).catch(console.error);
        }
      }, IDLE_TIMEOUT);
    },
    [documentId, triggerIdleSave]
  );

  return { scheduleIdleSave };
}
