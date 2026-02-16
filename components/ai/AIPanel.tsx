"use client";

import { Id } from "@/convex/_generated/dataModel";

interface AIPanelProps {
  documentId: Id<"documents">;
}

export function AIPanel({ documentId }: AIPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <h3 className="text-sm font-medium">AI Assistant</h3>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">
          AI chat will be here (Phase 3)
        </p>
      </div>
    </div>
  );
}
