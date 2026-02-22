"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

interface RestoreDividerProps {
  documentId: Id<"documents">;
  messageId: Id<"aiMessages">;
}

export function RestoreDivider({ documentId, messageId }: RestoreDividerProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreToMessage = useAction(api.undoAction.restoreToMessage);

  return (
    <div className="group/restore relative -mx-1 px-1 h-0 hover:h-6 overflow-visible transition-[height] duration-200">
      <button
        className="absolute left-1 right-1 top-0 flex items-center gap-2 cursor-pointer opacity-0 group-hover/restore:opacity-100 transition-opacity duration-200 z-10 h-6"
        disabled={isRestoring}
        onClick={async () => {
          if (!window.confirm(
            "Restore the document to this point? This will revert the document and remove all messages from here onward. This cannot be undone."
          )) return;
          setIsRestoring(true);
          try {
            await restoreToMessage({ documentId, messageId });
          } catch (err) {
            console.error("Failed to restore:", err);
          } finally {
            setIsRestoring(false);
          }
        }}
      >
        <span className="flex-1 h-px bg-muted-foreground/30" />
        <span className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors whitespace-nowrap">
          {isRestoring ? "Restoring…" : "Restore here"}
        </span>
        <span className="flex-1 h-px bg-muted-foreground/30" />
      </button>
    </div>
  );
}
