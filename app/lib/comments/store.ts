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

function getStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function loadState(): CommentState {
  const storage = getStorage();
  if (!storage) return inMemoryState;
  const raw = safeGetItem(storage, STORAGE_KEY);
  if (!raw) return { comments: [] };
  try {
    const parsed = JSON.parse(raw) as { comments?: unknown };
    if (!Array.isArray(parsed.comments)) {
      return { comments: [] };
    }

    const sanitizedComments = parsed.comments.flatMap((comment) => {
      if (!comment || typeof comment !== "object") {
        return [];
      }
      const candidate = comment as Partial<CommentRecord>;

      const normalizedDocumentId = normalizeDocumentId(candidate.documentId);
      const normalizedCommentId = normalizeCommentReferenceId(candidate.id);
      const normalizedContent =
        typeof candidate.content === "string" ? candidate.content.trim() : undefined;
      const normalizedAnchorText = normalizeAnchorText(candidate.anchorText);
      const normalizedParentCommentId = normalizeCommentReferenceId(
        candidate.parentCommentId,
      );
      const normalizedUserId =
        typeof candidate.userId === "string" ? candidate.userId.trim() : undefined;
      const safeUserId =
        normalizedUserId &&
        normalizedUserId.length <= MAX_USER_ID_LENGTH &&
        !hasControlChars(normalizedUserId)
          ? normalizedUserId
          : DEFAULT_LOCAL_USER_ID;
      const normalizedAnchorFrom =
        typeof candidate.anchorFrom === "number" && Number.isFinite(candidate.anchorFrom)
          ? Math.max(0, candidate.anchorFrom)
          : 0;
      const normalizedAnchorTo =
        typeof candidate.anchorTo === "number" && Number.isFinite(candidate.anchorTo)
          ? Math.max(normalizedAnchorFrom, candidate.anchorTo)
          : normalizedAnchorFrom;

      if (
        !normalizedCommentId ||
        !isValidDocumentId(normalizedDocumentId) ||
        !normalizedContent ||
        hasDisallowedTextControlChars(normalizedContent) ||
        typeof candidate.createdAt !== "number" ||
        !Number.isFinite(candidate.createdAt) ||
        candidate.createdAt < 0 ||
        typeof candidate.updatedAt !== "number" ||
        !Number.isFinite(candidate.updatedAt) ||
        candidate.updatedAt < 0
      ) {
        return [];
      }

      const normalizedCreatedAt = candidate.createdAt;
      const normalizedUpdatedAt = Math.max(candidate.updatedAt, normalizedCreatedAt);

      return [
        {
          ...candidate,
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
          resolved: Boolean(candidate.resolved),
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
  inMemoryState.comments = [...state.comments];
  const storage = getStorage();
  if (!storage) {
    return;
  }
  safeSetItem(storage, STORAGE_KEY, JSON.stringify(state));
}

export function listComments(documentId: unknown) {
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

export function addComment(
  params: unknown,
) {
  const candidate =
    params && typeof params === "object"
      ? (params as {
          documentId?: unknown;
          content?: unknown;
          anchorText?: unknown;
          parentCommentId?: unknown;
          userId?: unknown;
        })
      : undefined;
  if (!candidate) {
    return null;
  }

  const documentId = safeReadAddCommentField(candidate, "documentId");
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return null;
  }
  const content = safeReadAddCommentField(candidate, "content");
  const normalizedContent =
    typeof content === "string" ? content.trim() : "";
  if (
    !normalizedContent ||
    hasDisallowedTextControlChars(normalizedContent)
  ) {
    return null;
  }
  const anchorText = safeReadAddCommentField(candidate, "anchorText");
  const normalizedAnchorText = normalizeAnchorText(anchorText);
  const parentCommentId = safeReadAddCommentField(candidate, "parentCommentId");
  const normalizedParentCommentId = normalizeCommentReferenceId(parentCommentId);

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
  const now = safeNow();
  const userId = safeReadAddCommentField(candidate, "userId");
  const normalizedUserId =
    typeof userId === "string" ? userId.trim() : undefined;
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

export function resolveComment(commentId: unknown) {
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
    updatedAt: Math.max(safeNow(), state.comments[index].updatedAt),
  };
  persistState(state);
  return state.comments[index];
}

export function resetCommentsForTests() {
  inMemoryState.comments = [];
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

function safeGetItem(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    return;
  }
}

function safeReadAddCommentField(
  params: {
    documentId?: unknown;
    content?: unknown;
    anchorText?: unknown;
    parentCommentId?: unknown;
    userId?: unknown;
  },
  key: "documentId" | "content" | "anchorText" | "parentCommentId" | "userId",
) {
  try {
    return params[key];
  } catch {
    return undefined;
  }
}

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}
