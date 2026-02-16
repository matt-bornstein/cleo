"use client";

import { useState } from "react";

import { CommentInput } from "@/components/comments/CommentInput";
import type { CommentRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";

type CommentThreadProps = {
  comment: CommentRecord;
  replies: CommentRecord[];
  onResolve: (commentId: string) => void;
  onReply: (parentCommentId: string, content: string) => void;
  canComment?: boolean;
};

function getAuthorLabel(userId: string | undefined) {
  if (typeof userId !== "string") return "Unknown user";
  const normalizedUserId = userId.trim();
  return normalizedUserId.length > 0 ? normalizedUserId : "Unknown user";
}

export function CommentThread({
  comment,
  replies,
  onResolve,
  onReply,
  canComment = true,
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const authorLabel = getAuthorLabel(comment.userId);

  return (
    <article className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div className="mb-1 text-xs text-slate-500">
        Anchor: {comment.anchorText || "No anchor text"}
      </div>
      <div className="mb-1 text-xs text-slate-500">By: {authorLabel}</div>
      <p className="text-slate-800">{comment.content}</p>
      <div className="mt-2 flex justify-between">
        <span className="text-xs text-slate-500">
          {comment.resolved ? "Resolved" : "Open"}
        </span>
        <div className="flex items-center gap-1">
          {!comment.resolved && canComment ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsReplying((value) => !value)}
              >
                Reply
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onResolve(comment.id)}>
                Resolve
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {isReplying && canComment ? (
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <CommentInput
            placeholder="Reply to comment"
            onSubmit={(value) => {
              onReply(comment.id, value);
              setIsReplying(false);
            }}
          />
        </div>
      ) : null}
      {replies.length > 0 ? (
        <div className="mt-2 space-y-1 border-l border-slate-200 pl-2">
          {replies.map((reply) => (
            <p key={reply.id} className="text-xs text-slate-700">
              ↳ {getAuthorLabel(reply.userId)}: {reply.content}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
