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

  return {
    comments,
    createComment,
    markResolved,
  };
}
