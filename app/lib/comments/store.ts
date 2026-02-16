import type { CommentRecord } from "@/lib/types";

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
  return loadState()
    .comments.filter((comment) => comment.documentId === documentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function addComment(params: {
  documentId: string;
  content: string;
  anchorText: string;
  parentCommentId?: string;
}) {
  const state = loadState();
  const now = Date.now();
  const comment: CommentRecord = {
    id: crypto.randomUUID(),
    documentId: params.documentId,
    userId: "local-dev-user",
    content: params.content,
    anchorFrom: 0,
    anchorTo: 0,
    anchorText: params.anchorText,
    resolved: false,
    parentCommentId: params.parentCommentId,
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
