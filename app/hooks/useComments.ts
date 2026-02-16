"use client";

import { useCallback, useMemo, useState } from "react";

import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { addComment, listComments, resolveComment } from "@/lib/comments/store";
import type { CommentRecord } from "@/lib/types";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";
import { hasControlChars } from "@/lib/validators/controlChars";

export function useComments(documentId: unknown, currentUserId?: unknown) {
  const [version, setVersion] = useState(0);
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const hasValidDocumentId = isValidDocumentId(normalizedDocumentId);
  const normalizedCurrentUserIdCandidate =
    typeof currentUserId === "string" ? currentUserId.trim() : undefined;
  const normalizedCurrentUserId =
    normalizedCurrentUserIdCandidate &&
    normalizedCurrentUserIdCandidate.length <= MAX_USER_ID_LENGTH &&
    !hasControlChars(normalizedCurrentUserIdCandidate)
      ? normalizedCurrentUserIdCandidate
      : undefined;

  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const comments = useMemo(() => {
    void version;
    if (!hasValidDocumentId) return [];
    return safeNormalizeComments(
      safeListComments(normalizedDocumentId),
      normalizedDocumentId,
    );
  }, [hasValidDocumentId, normalizedDocumentId, version]);

  const createComment = useCallback(
    (content: unknown, anchorText: unknown, parentCommentId?: unknown) => {
      if (!hasValidDocumentId) {
        return null;
      }
      const normalizedContent = typeof content === "string" ? content : "";
      if (normalizedContent.trim().length === 0) {
        return null;
      }
      const normalizedAnchorText = typeof anchorText === "string" ? anchorText : "";
      const normalizedParentCommentId =
        typeof parentCommentId === "string" ? parentCommentId : undefined;
      const comment = safeAddComment({
        documentId: normalizedDocumentId,
        content: normalizedContent,
        anchorText: normalizedAnchorText,
        parentCommentId: normalizedParentCommentId,
        userId: normalizedCurrentUserId,
      });
      if (comment) {
        refresh();
      }
      return comment;
    },
    [hasValidDocumentId, normalizedDocumentId, normalizedCurrentUserId, refresh],
  );

  const markResolved = useCallback(
    (commentId: unknown) => {
      if (!hasValidDocumentId) {
        return null;
      }
      const normalizedCommentId = typeof commentId === "string" ? commentId : "";
      if (!normalizedCommentId) {
        return null;
      }
      const existing = comments.find((comment) => comment.id === normalizedCommentId);
      const updated = safeResolveComment(normalizedCommentId);
      if (updated && (!existing || !existing.resolved)) {
        refresh();
      }
      return updated;
    },
    [comments, hasValidDocumentId, refresh],
  );

  const createReply = useCallback(
    (parentCommentId: unknown, content: unknown) => {
      if (!hasValidDocumentId) {
        return null;
      }
      const normalizedParentCommentId =
        typeof parentCommentId === "string" ? parentCommentId.trim() : "";
      const normalizedContent = typeof content === "string" ? content : "";
      if (normalizedContent.trim().length === 0) {
        return null;
      }
      const parent = comments.find((comment) => comment.id === normalizedParentCommentId);
      const anchorText = parent?.anchorText ?? "Reply";
      const parentIdForReply =
        parent && normalizedParentCommentId.length > 0
          ? normalizedParentCommentId
          : undefined;
      const reply = safeAddComment({
        documentId: normalizedDocumentId,
        content: normalizedContent,
        anchorText,
        parentCommentId: parentIdForReply,
        userId: normalizedCurrentUserId,
      });
      if (reply) {
        refresh();
      }
      return reply;
    },
    [comments, hasValidDocumentId, normalizedDocumentId, normalizedCurrentUserId, refresh],
  );

  return {
    comments,
    createComment,
    createReply,
    markResolved,
  };
}

function safeListComments(documentId: string) {
  try {
    return listComments(documentId);
  } catch {
    return [];
  }
}

function safeAddComment(payload: Parameters<typeof addComment>[0]) {
  try {
    return addComment(payload);
  } catch {
    return null;
  }
}

function safeResolveComment(commentId: string) {
  try {
    return resolveComment(commentId);
  } catch {
    return null;
  }
}

function safeNormalizeComments(comments: unknown, fallbackDocumentId: string) {
  if (!Array.isArray(comments)) {
    return [] as CommentRecord[];
  }

  return comments.flatMap((comment, index) => {
    const normalizedComment = safeNormalizeComment(comment, fallbackDocumentId, index);
    return normalizedComment ? [normalizedComment] : [];
  });
}

function safeNormalizeComment(
  comment: unknown,
  fallbackDocumentId: string,
  fallbackIndex: number,
) {
  if (!comment || typeof comment !== "object") {
    return null;
  }

  const id = safeReadCommentField(comment, "id");
  const normalizedId =
    typeof id === "string" && id.trim().length > 0 && !hasControlChars(id.trim())
      ? id.trim()
      : `comment-${fallbackIndex}`;
  const documentId = safeReadCommentField(comment, "documentId");
  const normalizedDocumentId =
    typeof documentId === "string" &&
    documentId.trim().length > 0 &&
    !hasControlChars(documentId.trim())
      ? documentId.trim()
      : fallbackDocumentId;
  const userId = safeReadCommentField(comment, "userId");
  const normalizedUserId =
    typeof userId === "string" &&
    userId.trim().length > 0 &&
    userId.trim().length <= MAX_USER_ID_LENGTH &&
    !hasControlChars(userId.trim())
      ? userId.trim()
      : DEFAULT_LOCAL_USER_ID;
  const content = safeReadCommentField(comment, "content");
  const normalizedContent = typeof content === "string" ? content : "";
  const anchorText = safeReadCommentField(comment, "anchorText");
  const normalizedAnchorText =
    typeof anchorText === "string" && anchorText.trim().length > 0
      ? anchorText.trim()
      : "Reply";
  const resolved = safeReadCommentField(comment, "resolved");
  const anchorFrom = safeReadCommentField(comment, "anchorFrom");
  const normalizedAnchorFrom =
    typeof anchorFrom === "number" && Number.isFinite(anchorFrom) && anchorFrom >= 0
      ? anchorFrom
      : 0;
  const anchorTo = safeReadCommentField(comment, "anchorTo");
  const normalizedAnchorTo =
    typeof anchorTo === "number" && Number.isFinite(anchorTo) && anchorTo >= normalizedAnchorFrom
      ? anchorTo
      : normalizedAnchorFrom;
  const createdAt = safeReadCommentField(comment, "createdAt");
  const normalizedCreatedAt =
    typeof createdAt === "number" && Number.isFinite(createdAt) && createdAt >= 0
      ? createdAt
      : 0;
  const updatedAt = safeReadCommentField(comment, "updatedAt");
  const normalizedUpdatedAt =
    typeof updatedAt === "number" && Number.isFinite(updatedAt) && updatedAt >= 0
      ? Math.max(updatedAt, normalizedCreatedAt)
      : normalizedCreatedAt;
  const parentCommentId = safeReadCommentField(comment, "parentCommentId");
  const normalizedParentCommentId =
    typeof parentCommentId === "string" &&
    parentCommentId.trim().length > 0 &&
    !hasControlChars(parentCommentId.trim()) &&
    parentCommentId.trim() !== normalizedId
      ? parentCommentId.trim()
      : undefined;

  return {
    id: normalizedId,
    documentId: normalizedDocumentId,
    userId: normalizedUserId,
    content: normalizedContent,
    anchorFrom: normalizedAnchorFrom,
    anchorTo: normalizedAnchorTo,
    anchorText: normalizedAnchorText,
    resolved: resolved === true,
    parentCommentId: normalizedParentCommentId,
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedUpdatedAt,
  } satisfies CommentRecord;
}

function safeReadCommentField(comment: unknown, key: keyof CommentRecord) {
  if (!comment || typeof comment !== "object") {
    return undefined;
  }

  try {
    return (comment as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}
