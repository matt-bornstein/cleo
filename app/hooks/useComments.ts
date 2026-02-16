"use client";

import { useCallback, useMemo, useState } from "react";

import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { addComment, listComments, resolveComment } from "@/lib/comments/store";

export function useComments(documentId: string, currentUserId?: unknown) {
  const [version, setVersion] = useState(0);
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const hasValidDocumentId = isValidDocumentId(normalizedDocumentId);
  const normalizedCurrentUserId =
    typeof currentUserId === "string" ? currentUserId.trim() : undefined;

  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const comments = useMemo(() => {
    void version;
    if (!hasValidDocumentId) return [];
    return listComments(normalizedDocumentId);
  }, [hasValidDocumentId, normalizedDocumentId, version]);

  const createComment = useCallback(
    (content: unknown, anchorText: unknown, parentCommentId?: unknown) => {
      if (!hasValidDocumentId) {
        return null;
      }
      const normalizedContent = typeof content === "string" ? content : "";
      const normalizedAnchorText = typeof anchorText === "string" ? anchorText : "";
      const normalizedParentCommentId =
        typeof parentCommentId === "string" ? parentCommentId : undefined;
      const comment = addComment({
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
      const existing = comments.find((comment) => comment.id === normalizedCommentId);
      const updated = resolveComment(normalizedCommentId);
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
      const parent = comments.find((comment) => comment.id === normalizedParentCommentId);
      const anchorText = parent?.anchorText ?? "Reply";
      const parentIdForReply =
        parent && normalizedParentCommentId.length > 0
          ? normalizedParentCommentId
          : undefined;
      const reply = addComment({
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
