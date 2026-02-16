import { diff_match_patch } from "diff-match-patch";

import {
  getDocumentById,
  setDocumentLastDiffAt,
  updateDocumentContent,
} from "@/lib/documents/store";
import type { DiffRecord, DiffSource } from "@/lib/types";

const STORAGE_KEY = "plan00.diffs.v1";
const dmp = new diff_match_patch();

type DiffStoreState = {
  diffs: DiffRecord[];
};

const inMemoryState: DiffStoreState = {
  diffs: [],
};

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadState(): DiffStoreState {
  if (!canUseStorage()) {
    return inMemoryState;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { diffs: [] };
  try {
    const parsed = JSON.parse(raw) as DiffStoreState;
    return parsed.diffs ? parsed : { diffs: [] };
  } catch {
    return { diffs: [] };
  }
}

function persistState(state: DiffStoreState) {
  if (!canUseStorage()) {
    inMemoryState.diffs = state.diffs;
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createDiffPatch(previousSnapshot: string, nextSnapshot: string) {
  const patches = dmp.patch_make(previousSnapshot, nextSnapshot);
  return dmp.patch_toText(patches);
}

export function createDiff(params: {
  documentId: string;
  userId: string;
  snapshotAfter: string;
  source: DiffSource;
  aiPrompt?: string;
  aiModel?: string;
}) {
  const state = loadState();
  const previousSnapshot =
    state.diffs.find((diff) => diff.documentId === params.documentId)
      ?.snapshotAfter ??
    JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

  const patch = createDiffPatch(previousSnapshot, params.snapshotAfter);
  const diffRecord: DiffRecord = {
    id: crypto.randomUUID(),
    documentId: params.documentId,
    userId: params.userId,
    patch,
    snapshotAfter: params.snapshotAfter,
    source: params.source,
    aiPrompt: params.aiPrompt,
    aiModel: params.aiModel,
    createdAt: Date.now(),
  };

  state.diffs = [diffRecord, ...state.diffs];
  persistState(state);
  return diffRecord;
}

export function listDiffsByDocument(documentId: string) {
  return loadState()
    .diffs.filter((diff) => diff.documentId === documentId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function ensureCreatedDiff(params: {
  documentId: string;
  snapshot: string;
  userId?: string;
}) {
  const existing = listDiffsByDocument(params.documentId);
  if (existing.length > 0) {
    return existing[0];
  }

  return createDiff({
    documentId: params.documentId,
    userId: params.userId ?? "local-dev-user",
    snapshotAfter: params.snapshot,
    source: "created",
  });
}

export function restoreVersion(params: {
  documentId: string;
  snapshot: string;
  userId?: string;
}) {
  const document = getDocumentById(params.documentId);
  if (!document) {
    return { restored: false as const, reason: "missing_document" as const };
  }

  const now = Date.now();
  updateDocumentContent(params.documentId, params.snapshot);
  setDocumentLastDiffAt(params.documentId, now);
  const diff = createDiff({
    documentId: params.documentId,
    userId: params.userId ?? "local-dev-user",
    snapshotAfter: params.snapshot,
    source: "manual",
  });

  return { restored: true as const, diffId: diff.id };
}

export function triggerIdleSave(params: {
  documentId: string;
  snapshot: string;
  dedupWindowMs?: number;
}) {
  const dedupWindowMs = params.dedupWindowMs ?? 4000;
  const now = Date.now();
  const document = getDocumentById(params.documentId);
  if (!document) {
    return { skipped: true, reason: "missing_document" as const };
  }

  if (document.lastDiffAt && now - document.lastDiffAt < dedupWindowMs) {
    return { skipped: true, reason: "dedup_window" as const };
  }

  const previousSnapshot =
    listDiffsByDocument(params.documentId)[0]?.snapshotAfter ?? document.content;

  if (previousSnapshot === params.snapshot) {
    setDocumentLastDiffAt(params.documentId, now);
    return { skipped: true, reason: "no_change" as const };
  }

  updateDocumentContent(params.documentId, params.snapshot);
  setDocumentLastDiffAt(params.documentId, now);
  const diff = createDiff({
    documentId: params.documentId,
    userId: "local-dev-user",
    snapshotAfter: params.snapshot,
    source: "manual",
  });

  return { skipped: false, diffId: diff.id };
}

export function resetDiffsForTests() {
  persistState({ diffs: [] });
}
