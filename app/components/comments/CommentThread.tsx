"use client";

import { useState } from "react";

import { CommentInput } from "@/components/comments/CommentInput";
import { Button } from "@/components/ui/button";
import { hasControlChars } from "@/lib/validators/controlChars";

type CommentThreadProps = {
  comment: unknown;
  replies: unknown;
  onResolve: unknown;
  onReply: unknown;
  canComment?: unknown;
};

function getAuthorLabel(userId: string | undefined) {
  if (typeof userId !== "string") return "Unknown user";
  const normalizedUserId = userId.trim();
  return normalizedUserId.length > 0 ? normalizedUserId : "Unknown user";
}

type DisplayComment = {
  id: string;
  userId?: string;
  content: string;
  anchorText: string;
  resolved: boolean;
};

function normalizeDisplayComment(value: unknown, fallbackId: string): DisplayComment {
  const candidate =
    value && typeof value === "object"
      ? (value as {
          id?: unknown;
          userId?: unknown;
          content?: unknown;
          anchorText?: unknown;
          resolved?: unknown;
        })
      : undefined;
  const normalizedId =
    typeof candidate?.id === "string" &&
    candidate.id.trim().length > 0 &&
    !hasControlChars(candidate.id.trim())
      ? candidate.id.trim()
      : fallbackId;
  return {
    id: normalizedId,
    userId: typeof candidate?.userId === "string" ? candidate.userId : undefined,
    content: typeof candidate?.content === "string" ? candidate.content : "",
    anchorText:
      typeof candidate?.anchorText === "string" &&
      candidate.anchorText.trim().length > 0 &&
      !hasControlChars(candidate.anchorText.trim())
        ? candidate.anchorText.trim()
        : "No anchor text",
    resolved: candidate?.resolved === true,
  };
}

export function CommentThread({
  comment,
  replies,
  onResolve,
  onReply,
  canComment = true,
}: CommentThreadProps) {
  const normalizedCanComment = canComment !== false;
  const normalizedComment = normalizeDisplayComment(comment, "comment");
  const normalizedReplies = Array.isArray(replies)
    ? replies.map((reply, index) =>
        normalizeDisplayComment(reply, `reply-${index}`),
      )
    : [];
  const [isReplying, setIsReplying] = useState(false);
  const authorLabel = getAuthorLabel(normalizedComment.userId);

  return (
    <article className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div className="mb-1 text-xs text-slate-500">
        Anchor: {normalizedComment.anchorText}
      </div>
      <div className="mb-1 text-xs text-slate-500">By: {authorLabel}</div>
      <p className="text-slate-800">{normalizedComment.content}</p>
      <div className="mt-2 flex justify-between">
        <span className="text-xs text-slate-500">
          {normalizedComment.resolved ? "Resolved" : "Open"}
        </span>
        <div className="flex items-center gap-1">
          {!normalizedComment.resolved && normalizedCanComment ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsReplying((value) => !value)}
              >
                Reply
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (typeof onResolve === "function") {
                    onResolve(normalizedComment.id);
                  }
                }}
              >
                Resolve
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {isReplying && normalizedCanComment ? (
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <CommentInput
            placeholder="Reply to comment"
            onSubmit={(value: string) => {
              if (typeof onReply === "function") {
                onReply(normalizedComment.id, value);
              }
              setIsReplying(false);
            }}
          />
        </div>
      ) : null}
      {normalizedReplies.length > 0 ? (
        <div className="mt-2 space-y-1 border-l border-slate-200 pl-2">
          {normalizedReplies.map((reply) => (
            <p key={reply.id} className="text-xs text-slate-700">
              ↳ {getAuthorLabel(reply.userId)}: {reply.content}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
