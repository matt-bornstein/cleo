"use client";

import { Id } from "@/convex/_generated/dataModel";

interface EditorPanelProps {
  documentId: Id<"documents">;
  initialContent: string;
}

export function EditorPanel({ documentId, initialContent }: EditorPanelProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b p-2 text-sm text-muted-foreground">
        Formatting toolbar (Phase 2)
      </div>
      <div className="flex-1 p-4">
        <p className="text-muted-foreground">
          Editor will be here (Phase 2). Document: {documentId}
        </p>
      </div>
    </div>
  );
}
