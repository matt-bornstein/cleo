"use client";

import { useCallback, useMemo, useState } from "react";

import { addComment, listComments, resolveComment } from "@/lib/comments/store";

export function useComments(documentId: string) {
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const comments = useMemo(() => {
    void version;
    return listComments(documentId);
  }, [documentId, version]);

  const createComment = useCallback(
    (content: string, anchorText: string, parentCommentId?: string) => {
      const comment = addComment({ documentId, content, anchorText, parentCommentId });
      refresh();
      return comment;
    },
    [documentId, refresh],
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
      const parent = comments.find((comment) => comment.id === parentCommentId);
      const anchorText = parent?.anchorText ?? "Reply";
      const reply = addComment({
        documentId,
        content,
        anchorText,
        parentCommentId,
      });
      refresh();
      return reply;
    },
    [comments, documentId, refresh],
  );

  return {
    comments,
    createComment,
    createReply,
    markResolved,
  };
}
