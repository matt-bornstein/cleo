import type { CommentRecord } from "@/lib/types";
import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";
import { generateLocalId } from "@/lib/utils/id";
import {
  hasControlChars,
  hasDisallowedTextControlChars,
} from "@/lib/validators/controlChars";

const STORAGE_KEY = "plan00.comments.v1";

type CommentState = {
  comments: CommentRecord[];
};

const inMemoryState: CommentState = { comments: [] };

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadState(): CommentState {
  if (!canUseStorage()) return inMemoryState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { comments: [] };
  try {
    const parsed = JSON.parse(raw) as { comments?: unknown };
    if (!Array.isArray(parsed.comments)) {
      return { comments: [] };
    }

    const sanitizedComments = parsed.comments.flatMap((comment) => {
      const normalizedDocumentId = normalizeDocumentId(comment.documentId);
      const normalizedCommentId = normalizeCommentReferenceId(comment.id);
      const normalizedContent =
        typeof comment.content === "string" ? comment.content.trim() : undefined;
      const normalizedAnchorText = normalizeAnchorText(comment.anchorText);
      const normalizedParentCommentId = normalizeCommentReferenceId(
        comment.parentCommentId,
      );
      const normalizedUserId =
        typeof comment.userId === "string" ? comment.userId.trim() : undefined;
      const safeUserId =
        normalizedUserId &&
        normalizedUserId.length <= MAX_USER_ID_LENGTH &&
        !hasControlChars(normalizedUserId)
          ? normalizedUserId
          : DEFAULT_LOCAL_USER_ID;
      const normalizedAnchorFrom =
        typeof comment.anchorFrom === "number" && Number.isFinite(comment.anchorFrom)
          ? Math.max(0, comment.anchorFrom)
          : 0;
      const normalizedAnchorTo =
        typeof comment.anchorTo === "number" && Number.isFinite(comment.anchorTo)
          ? Math.max(normalizedAnchorFrom, comment.anchorTo)
          : normalizedAnchorFrom;

      if (
        !normalizedCommentId ||
        !isValidDocumentId(normalizedDocumentId) ||
        !normalizedContent ||
        hasDisallowedTextControlChars(normalizedContent) ||
        typeof comment.createdAt !== "number" ||
        !Number.isFinite(comment.createdAt) ||
        comment.createdAt < 0 ||
        typeof comment.updatedAt !== "number" ||
        !Number.isFinite(comment.updatedAt) ||
        comment.updatedAt < 0
      ) {
        return [];
      }

      const normalizedCreatedAt = comment.createdAt;
      const normalizedUpdatedAt = Math.max(comment.updatedAt, normalizedCreatedAt);

      return [
        {
          ...comment,
          id: normalizedCommentId,
          documentId: normalizedDocumentId,
          userId: safeUserId,
          content: normalizedContent,
          anchorText: normalizedAnchorText,
          parentCommentId:
            normalizedParentCommentId &&
            normalizedParentCommentId !== normalizedCommentId
              ? normalizedParentCommentId
              : undefined,
          resolved: Boolean(comment.resolved),
          anchorFrom: normalizedAnchorFrom,
          anchorTo: normalizedAnchorTo,
          createdAt: normalizedCreatedAt,
          updatedAt: normalizedUpdatedAt,
        },
      ];
    });

    const dedupedByCommentId = new Map<string, CommentRecord>();
    for (const comment of sanitizedComments) {
      const existing = dedupedByCommentId.get(comment.id);
      if (!existing) {
        dedupedByCommentId.set(comment.id, comment);
        continue;
      }

      if (comment.updatedAt > existing.updatedAt) {
        dedupedByCommentId.set(comment.id, comment);
        continue;
      }

      if (comment.updatedAt === existing.updatedAt && comment.createdAt > existing.createdAt) {
        dedupedByCommentId.set(comment.id, comment);
      }
    }

    const dedupedComments = Array.from(dedupedByCommentId.values());
    const commentsByDocumentAndId = new Map<string, Map<string, CommentRecord>>();
    for (const comment of dedupedComments) {
      const commentsById = commentsByDocumentAndId.get(comment.documentId) ?? new Map();
      commentsById.set(comment.id, comment);
      commentsByDocumentAndId.set(comment.documentId, commentsById);
    }

    return {
      comments: dedupedComments.map((comment) => {
        const commentsById = commentsByDocumentAndId.get(comment.documentId);
        const normalizedParentCommentId =
          comment.parentCommentId &&
          isValidParentCommentReference(comment.id, comment.parentCommentId, commentsById)
            ? comment.parentCommentId
            : undefined;

        if (normalizedParentCommentId === comment.parentCommentId) {
          return comment;
        }

        return {
          ...comment,
          parentCommentId: normalizedParentCommentId,
        };
      }),
    };
  } catch {
    return { comments: [] };
  }
}

function persistState(state: CommentState) {
  if (!canUseStorage()) {
    inMemoryState.comments = state.comments;
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function listComments(documentId: string) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return [];

  return loadState()
    .comments.filter((comment) => comment.documentId === normalizedDocumentId)
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id)
        : a.createdAt - b.createdAt,
    );
}

export function addComment(params: {
  documentId: string;
  content: string;
  anchorText: string;
  parentCommentId?: string;
  userId?: string;
}) {
  const normalizedDocumentId = normalizeDocumentId(params.documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return null;
  }
  const normalizedContent =
    typeof params.content === "string" ? params.content.trim() : "";
  if (
    !normalizedContent ||
    hasDisallowedTextControlChars(normalizedContent)
  ) {
    return null;
  }
  const normalizedAnchorText = normalizeAnchorText(params.anchorText);
  const normalizedParentCommentId = normalizeCommentReferenceId(params.parentCommentId);

  const state = loadState();
  const safeParentCommentId =
    normalizedParentCommentId &&
    state.comments.some(
      (comment) =>
        comment.id === normalizedParentCommentId &&
        comment.documentId === normalizedDocumentId,
    )
      ? normalizedParentCommentId
      : undefined;
  const now = Math.max(0, Date.now());
  const normalizedUserId =
    typeof params.userId === "string" ? params.userId.trim() : undefined;
  const comment: CommentRecord = {
    id: generateLocalId(),
    documentId: normalizedDocumentId,
    userId:
      normalizedUserId &&
      normalizedUserId.length <= MAX_USER_ID_LENGTH &&
      !hasControlChars(normalizedUserId)
        ? normalizedUserId
        : DEFAULT_LOCAL_USER_ID,
    content: normalizedContent,
    anchorFrom: 0,
    anchorTo: 0,
    anchorText: normalizedAnchorText,
    resolved: false,
    parentCommentId: safeParentCommentId,
    createdAt: now,
    updatedAt: now,
  };
  state.comments.push(comment);
  persistState(state);
  return comment;
}

export function resolveComment(commentId: string) {
  const normalizedCommentId = normalizeCommentReferenceId(commentId);
  if (!normalizedCommentId) return null;

  const state = loadState();
  const index = state.comments.findIndex((comment) => comment.id === normalizedCommentId);
  if (index === -1) return null;
  if (state.comments[index].resolved) {
    return state.comments[index];
  }
  state.comments[index] = {
    ...state.comments[index],
    resolved: true,
    updatedAt: Math.max(Math.max(0, Date.now()), state.comments[index].updatedAt),
  };
  persistState(state);
  return state.comments[index];
}

export function resetCommentsForTests() {
  persistState({ comments: [] });
}

function normalizeCommentReferenceId(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : undefined;
  if (
    !normalizedValue ||
    normalizedValue.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedValue)
  ) {
    return undefined;
  }

  return normalizedValue;
}

function normalizeAnchorText(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : undefined;
  if (!normalizedValue || hasControlChars(normalizedValue)) {
    return "Comment";
  }

  return normalizedValue;
}

function isValidParentCommentReference(
  commentId: string,
  parentCommentId: string,
  commentsById: Map<string, CommentRecord> | undefined,
) {
  if (!commentsById) {
    return false;
  }

  let currentParentId: string | undefined = parentCommentId;
  const visited = new Set<string>([commentId]);
  while (currentParentId) {
    if (visited.has(currentParentId)) {
      return false;
    }

    visited.add(currentParentId);
    const parentComment = commentsById.get(currentParentId);
    if (!parentComment) {
      return false;
    }

    currentParentId = parentComment.parentCommentId;
  }

  return true;
}
