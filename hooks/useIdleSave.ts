"use client";

import { useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEditorContext } from "@/components/editor/EditorContext";

const IDLE_TIMEOUT = 2000; // 2 seconds
const MIN_SAVING_DISPLAY = 1000; // 1 second minimum for "Saving..." visibility

export function useIdleSave(documentId: Id<"documents">) {
  const triggerIdleSave = useMutation(api.diffs.triggerIdleSave);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<string | null>(null);
  const { setIsSaving } = useEditorContext();

  const scheduleIdleSave = useCallback(
    (content: string) => {
      latestContentRef.current = content;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(async () => {
        if (latestContentRef.current) {
          setIsSaving(true);
          const start = Date.now();
          try {
            await triggerIdleSave({
              documentId,
              content: latestContentRef.current,
            });
          } catch (e) {
            console.error(e);
          } finally {
            const elapsed = Date.now() - start;
            const remaining = MIN_SAVING_DISPLAY - elapsed;
            if (remaining > 0) {
              setTimeout(() => setIsSaving(false), remaining);
            } else {
              setIsSaving(false);
            }
          }
        }
      }, IDLE_TIMEOUT);
    },
    [documentId, triggerIdleSave, setIsSaving]
  );

  return { scheduleIdleSave };
}
