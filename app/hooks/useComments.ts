"use client";

import { useCallback, useMemo, useState } from "react";

import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { addComment, listComments, resolveComment } from "@/lib/comments/store";

export function useComments(documentId: string, currentUserId?: string) {
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
    (content: string, anchorText: string, parentCommentId?: string) => {
      if (!hasValidDocumentId) {
        return null;
      }
      const comment = addComment({
        documentId: normalizedDocumentId,
        content,
        anchorText,
        parentCommentId,
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
    (commentId: string) => {
      if (!hasValidDocumentId) {
        return null;
      }
      const existing = comments.find((comment) => comment.id === commentId);
      const updated = resolveComment(commentId);
      if (updated && (!existing || !existing.resolved)) {
        refresh();
      }
      return updated;
    },
    [comments, hasValidDocumentId, refresh],
  );

  const createReply = useCallback(
    (parentCommentId: string, content: string) => {
      if (!hasValidDocumentId) {
        return null;
      }
      const normalizedParentCommentId = parentCommentId.trim();
      const parent = comments.find((comment) => comment.id === normalizedParentCommentId);
      const anchorText = parent?.anchorText ?? "Reply";
      const parentIdForReply =
        parent && normalizedParentCommentId.length > 0
          ? normalizedParentCommentId
          : undefined;
      const reply = addComment({
        documentId: normalizedDocumentId,
        content,
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
