"use client";

import { Id } from "@/convex/_generated/dataModel";
import { RichTextEditor } from "./RichTextEditor";
import { useIdleSave } from "@/hooks/useIdleSave";
import { useCallback } from "react";

interface EditorPanelProps {
  documentId: Id<"documents">;
  initialContent: string;
}

export function EditorPanel({ documentId, initialContent }: EditorPanelProps) {
  const { scheduleIdleSave } = useIdleSave(documentId);

  const handleUpdate = useCallback(
    (json: string) => {
      scheduleIdleSave(json);
    },
    [scheduleIdleSave]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <RichTextEditor
        initialContent={initialContent}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
