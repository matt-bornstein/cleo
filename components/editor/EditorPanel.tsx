"use client";

import { Id } from "@/convex/_generated/dataModel";
import { CollaborativeEditor } from "./CollaborativeEditor";

interface EditorPanelProps {
  documentId: Id<"documents">;
  initialContent: string;
}

export function EditorPanel({ documentId }: EditorPanelProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CollaborativeEditor documentId={documentId} />
    </div>
  );
}
