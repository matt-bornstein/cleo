"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEditorContext } from "@/components/editor/EditorContext";
import { clearDiffHighlights } from "@/lib/editor/diffHighlights";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RestoreDividerProps {
  documentId: Id<"documents">;
  messageId: Id<"aiMessages">;
}

export function RestoreDivider({ documentId, messageId }: RestoreDividerProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const restoreToMessage = useAction(api.undoAction.restoreToMessage);
  const { refreshDecorations, setDiffCount } = useEditorContext();

  const handleRestore = async () => {
    setShowConfirm(false);
    setIsRestoring(true);
    try {
      await restoreToMessage({ documentId, messageId });
      clearDiffHighlights();
      setDiffCount(0);
      refreshDecorations();
    } catch (err) {
      console.error("Failed to restore:", err);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <div className="group/restore relative -mx-1 px-1 h-0 hover:h-6 overflow-visible transition-[height] duration-200">
        <button
          className="absolute left-1 right-1 top-0 flex items-center gap-2 cursor-pointer opacity-0 group-hover/restore:opacity-100 transition-opacity duration-200 z-10 h-6"
          disabled={isRestoring}
          onClick={() => setShowConfirm(true)}
        >
          <span className="flex-1 h-px bg-muted-foreground/30" />
          <span className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors whitespace-nowrap">
            {isRestoring ? "Restoring…" : "Restore here"}
          </span>
          <span className="flex-1 h-px bg-muted-foreground/30" />
        </button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore to this point?</AlertDialogTitle>
            <AlertDialogDescription>
              The document will be reverted and all messages from here onward
              will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
