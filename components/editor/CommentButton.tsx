"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MessageSquarePlus } from "lucide-react";

interface CommentButtonProps {
  editor: Editor;
  documentId: Id<"documents">;
}

export function CommentButton({ editor, documentId }: CommentButtonProps) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createComment = useMutation(api.comments.create);

  const handleCreate = async () => {
    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection

    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;

    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      await createComment({
        documentId,
        content: comment.trim(),
        anchorFrom: from,
        anchorTo: to,
        anchorText: selectedText.substring(0, 200), // Limit anchor text length
      });
      setComment("");
      setOpen(false);
    } catch (err) {
      console.error("Failed to create comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSelection = editor.state.selection.from !== editor.state.selection.to;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={!hasSelection}
          title={hasSelection ? "Add comment on selection" : "Select text to add a comment"}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium">Add Comment</h4>
            {hasSelection && (
              <p className="mt-1 text-xs text-muted-foreground italic truncate">
                &ldquo;{editor.state.doc.textBetween(
                  editor.state.selection.from,
                  editor.state.selection.to,
                  " "
                ).substring(0, 60)}&rdquo;
              </p>
            )}
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write your comment..."
            className="min-h-[80px] text-sm"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setComment("");
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!comment.trim() || isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Comment"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
