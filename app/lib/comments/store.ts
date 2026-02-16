import type { CommentRecord } from "@/lib/types";
import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";
import { hasControlChars } from "@/lib/validators/controlChars";

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
    const parsed = JSON.parse(raw) as CommentState;
    return parsed.comments ? parsed : { comments: [] };
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
    .sort((a, b) => a.createdAt - b.createdAt);
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
  const normalizedContent = params.content.trim();
  if (!normalizedContent) {
    return null;
  }
  const normalizedAnchorText = params.anchorText.trim() || "Comment";
  const normalizedParentCommentId = params.parentCommentId?.trim() || undefined;

  const state = loadState();
  const now = Date.now();
  const normalizedUserId = params.userId?.trim();
  const comment: CommentRecord = {
    id: crypto.randomUUID(),
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
    parentCommentId: normalizedParentCommentId,
    createdAt: now,
    updatedAt: now,
  };
  state.comments.push(comment);
  persistState(state);
  return comment;
}

export function resolveComment(commentId: string) {
  const state = loadState();
  const index = state.comments.findIndex((comment) => comment.id === commentId);
  if (index === -1) return null;
  state.comments[index] = {
    ...state.comments[index],
    resolved: true,
    updatedAt: Date.now(),
  };
  persistState(state);
  return state.comments[index];
}

export function resetCommentsForTests() {
  persistState({ comments: [] });
}
