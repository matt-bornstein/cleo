"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CommentThread } from "./CommentThread";
import { MessageSquare } from "lucide-react";

interface CommentsSidebarProps {
  documentId: Id<"documents">;
  showResolved?: boolean;
}

export function CommentsSidebar({
  documentId,
  showResolved = false,
}: CommentsSidebarProps) {
  const comments = useQuery(api.comments.list, { documentId });

  if (!comments) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading comments...
      </div>
    );
  }

  // Get top-level comments (no parent)
  const topLevel = comments.filter(
    (c) => !c.parentCommentId && (showResolved || !c.resolved)
  );

  // Get replies grouped by parent
  const repliesByParent = comments.reduce(
    (acc, c) => {
      if (c.parentCommentId) {
        if (!acc[c.parentCommentId]) acc[c.parentCommentId] = [];
        acc[c.parentCommentId].push(c);
      }
      return acc;
    },
    {} as Record<string, typeof comments>
  );

  if (topLevel.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No comments yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select text in the editor to add a comment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {topLevel.map((comment) => (
        <CommentThread
          key={comment._id}
          comment={comment}
          replies={repliesByParent[comment._id] || []}
          documentId={documentId}
        />
      ))}
    </div>
  );
}
