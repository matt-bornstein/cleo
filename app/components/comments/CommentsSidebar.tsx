"use client";

import { useMemo } from "react";

import { CommentInput } from "@/components/comments/CommentInput";
import { CommentThread } from "@/components/comments/CommentThread";
import type { CommentRecord } from "@/lib/types";
import { hasControlChars } from "@/lib/validators/controlChars";

type CommentsSidebarProps = {
  comments: unknown;
  onCreateComment: unknown;
  onReplyComment: unknown;
  onResolveComment: unknown;
  canComment?: unknown;
};

export function CommentsSidebar({
  comments,
  onCreateComment,
  onReplyComment,
  onResolveComment,
  canComment = true,
}: CommentsSidebarProps) {
  const normalizedCanComment = canComment !== false;
  const normalizedComments = useMemo(() => {
    if (!Array.isArray(comments)) {
      return [] as Array<CommentRecord & { parentCommentId?: string }>;
    }
    return comments.flatMap((comment) => {
      if (!comment || typeof comment !== "object") {
        return [];
      }

      const candidate = comment as Partial<CommentRecord>;
      const normalizedCommentId =
        typeof candidate.id === "string" &&
        candidate.id.trim().length > 0 &&
        !hasControlChars(candidate.id.trim())
          ? candidate.id.trim()
          : undefined;
      if (!normalizedCommentId) {
        return [];
      }

      const normalizedParentCommentId =
        typeof candidate.parentCommentId === "string" &&
        candidate.parentCommentId.trim().length > 0 &&
        !hasControlChars(candidate.parentCommentId.trim()) &&
        candidate.parentCommentId.trim() !== normalizedCommentId
          ? candidate.parentCommentId.trim()
          : undefined;

      return [
        {
          ...(candidate as CommentRecord),
          id: normalizedCommentId,
          parentCommentId: normalizedParentCommentId,
        },
      ];
    });
  }, [comments]);

  const rootComments = useMemo(
    () => normalizedComments.filter((comment) => !comment.parentCommentId),
    [normalizedComments],
  );

  const repliesByParentId = useMemo(() => {
    return normalizedComments
      .filter((comment) => !!comment.parentCommentId)
      .reduce<Record<string, CommentRecord[]>>((acc, comment) => {
        const parentCommentId = comment.parentCommentId!;
        acc[parentCommentId] = acc[parentCommentId] ?? [];
        acc[parentCommentId].push(comment);
        return acc;
      }, {});
  }, [normalizedComments]);

  return (
    <section className="w-full max-w-xs border-l border-slate-200 bg-slate-50 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Comments</h3>
      {normalizedCanComment ? (
        <CommentInput
          onSubmit={(content: string) => {
            if (typeof onCreateComment === "function") {
              onCreateComment(content);
            }
          }}
          placeholder="Comment on this doc"
        />
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-800">
          Commenting is disabled for your current role.
        </p>
      )}
      <div className="mt-3 space-y-2">
        {rootComments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            replies={repliesByParentId[comment.id] ?? []}
            onResolve={(commentId: string) => {
              if (typeof onResolveComment === "function") {
                onResolveComment(commentId);
              }
            }}
            onReply={(parentCommentId: string, content: string) => {
              if (typeof onReplyComment === "function") {
                onReplyComment(parentCommentId, content);
              }
            }}
            canComment={normalizedCanComment}
          />
        ))}
        {rootComments.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-500">
            No comments yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
