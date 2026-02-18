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
      const id = readCommentField(candidate, "id");
      const normalizedCommentId =
        typeof id === "string" &&
        id.trim().length > 0 &&
        !hasControlChars(id.trim())
          ? id.trim()
          : undefined;
      if (!normalizedCommentId) {
        return [];
      }

      const parentCommentId = readCommentField(candidate, "parentCommentId");
      const normalizedParentCommentId =
        typeof parentCommentId === "string" &&
        parentCommentId.trim().length > 0 &&
        !hasControlChars(parentCommentId.trim()) &&
        parentCommentId.trim() !== normalizedCommentId
          ? parentCommentId.trim()
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
    <section className="flex h-full min-h-0 w-full max-w-xs flex-col border-l border-slate-200 bg-slate-50 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Comments</h3>
      {normalizedCanComment ? (
        <CommentInput
          onSubmit={(content: string) => {
            safeOnCreateComment(onCreateComment, content);
          }}
          placeholder="Comment on this doc"
        />
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-800">
          Commenting is disabled for your current role.
        </p>
      )}
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {rootComments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            replies={repliesByParentId[comment.id] ?? []}
            onResolve={(commentId: string) => {
              safeOnResolveComment(onResolveComment, commentId);
            }}
            onReply={(parentCommentId: string, content: string) => {
              safeOnReplyComment(onReplyComment, parentCommentId, content);
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

function safeOnCreateComment(onCreateComment: unknown, content: string) {
  if (typeof onCreateComment !== "function") {
    return;
  }

  try {
    onCreateComment(content);
  } catch {
    return;
  }
}

function safeOnResolveComment(onResolveComment: unknown, commentId: string) {
  if (typeof onResolveComment !== "function") {
    return;
  }

  try {
    onResolveComment(commentId);
  } catch {
    return;
  }
}

function safeOnReplyComment(
  onReplyComment: unknown,
  parentCommentId: string,
  content: string,
) {
  if (typeof onReplyComment !== "function") {
    return;
  }

  try {
    onReplyComment(parentCommentId, content);
  } catch {
    return;
  }
}

function readCommentField(
  comment: Partial<CommentRecord>,
  key: "id" | "parentCommentId",
) {
  try {
    return comment[key];
  } catch {
    return undefined;
  }
}
