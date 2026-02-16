"use client";

import { useCallback, useMemo, useState } from "react";

import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { addComment, listComments, resolveComment } from "@/lib/comments/store";

export function useComments(documentId: string, currentUserId?: string) {
  const [version, setVersion] = useState(0);
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const hasValidDocumentId = isValidDocumentId(normalizedDocumentId);
  const normalizedCurrentUserId = currentUserId?.trim();

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
      const updated = resolveComment(commentId);
      refresh();
      return updated;
    },
    [refresh],
  );

  const createReply = useCallback(
    (parentCommentId: string, content: string) => {
      if (!hasValidDocumentId) {
        return null;
      }
      const parent = comments.find((comment) => comment.id === parentCommentId);
      const anchorText = parent?.anchorText ?? "Reply";
      const reply = addComment({
        documentId: normalizedDocumentId,
        content,
        anchorText,
        parentCommentId,
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
