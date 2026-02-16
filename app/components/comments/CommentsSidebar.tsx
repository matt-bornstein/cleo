"use client";

import { useMemo } from "react";

import { CommentInput } from "@/components/comments/CommentInput";
import { CommentThread } from "@/components/comments/CommentThread";
import type { CommentRecord } from "@/lib/types";

type CommentsSidebarProps = {
  comments: CommentRecord[];
  onCreateComment: (content: string) => void;
  onReplyComment: (parentCommentId: string, content: string) => void;
  onResolveComment: (commentId: string) => void;
  canComment?: boolean;
};

export function CommentsSidebar({
  comments,
  onCreateComment,
  onReplyComment,
  onResolveComment,
  canComment = true,
}: CommentsSidebarProps) {
  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parentCommentId),
    [comments],
  );

  const repliesByParentId = useMemo(() => {
    return comments
      .filter((comment) => !!comment.parentCommentId)
      .reduce<Record<string, CommentRecord[]>>((acc, comment) => {
        const parentCommentId = comment.parentCommentId!;
        acc[parentCommentId] = acc[parentCommentId] ?? [];
        acc[parentCommentId].push(comment);
        return acc;
      }, {});
  }, [comments]);

  return (
    <section className="w-full max-w-xs border-l border-slate-200 bg-slate-50 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Comments</h3>
      {canComment ? (
        <CommentInput onSubmit={onCreateComment} placeholder="Comment on this doc" />
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
            onResolve={onResolveComment}
            onReply={onReplyComment}
            canComment={canComment}
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
