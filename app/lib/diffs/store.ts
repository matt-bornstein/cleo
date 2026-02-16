import { diff_match_patch } from "diff-match-patch";

import { MAX_PROMPT_LENGTH, MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentContentJson } from "@/lib/ai/documentContent";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { getModelConfig } from "@/lib/ai/models";
import {
  getDocumentById,
  setDocumentLastDiffAt,
  updateDocumentContent,
} from "@/lib/documents/store";
import type { DiffRecord, DiffSource } from "@/lib/types";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";
import { generateLocalId } from "@/lib/utils/id";
import {
  hasControlChars,
  hasDisallowedTextControlChars,
} from "@/lib/validators/controlChars";

const STORAGE_KEY = "plan00.diffs.v1";
const dmp = new diff_match_patch();

type DiffStoreState = {
  diffs: DiffRecord[];
};

const inMemoryState: DiffStoreState = {
  diffs: [],
};
const ALLOWED_SOURCES = new Set<DiffSource>(["manual", "created", "ai"]);

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

function loadState(): DiffStoreState {
  const storage = getStorage();
  if (!storage) {
    return inMemoryState;
  }
  const raw = safeGetItem(storage, STORAGE_KEY);
  if (!raw) return { diffs: [] };
  try {
    const parsed = JSON.parse(raw) as { diffs?: unknown };
    if (!Array.isArray(parsed.diffs)) {
      return { diffs: [] };
    }

    const sanitizedDiffs = parsed.diffs.flatMap((diff) => {
      if (!diff || typeof diff !== "object") {
        return [];
      }
      const candidate = diff as Partial<DiffRecord>;

      const normalizedDocumentId = normalizeDocumentId(candidate.documentId);
      const normalizedDiffId = normalizeDiffReferenceId(candidate.id);
      const normalizedMetadata = normalizeDiffMetadata(candidate.aiPrompt, candidate.aiModel);
      if (
        !normalizedDiffId ||
        !isValidDocumentId(normalizedDocumentId) ||
        !ALLOWED_SOURCES.has(candidate.source as DiffSource) ||
        !normalizedMetadata ||
        typeof candidate.patch !== "string" ||
        !isValidDocumentContentJson(candidate.snapshotAfter) ||
        typeof candidate.createdAt !== "number" ||
        !Number.isFinite(candidate.createdAt) ||
        candidate.createdAt < 0
      ) {
        return [];
      }

      return [
        {
          ...candidate,
          id: normalizedDiffId,
          documentId: normalizedDocumentId,
          source: candidate.source as DiffSource,
          patch: candidate.patch,
          snapshotAfter: candidate.snapshotAfter,
          createdAt: candidate.createdAt,
          userId: normalizeDiffUserId(candidate.userId),
          aiPrompt: normalizedMetadata.aiPrompt,
          aiModel: normalizedMetadata.aiModel,
        },
      ];
    });

    const dedupedByDiffId = new Map<string, DiffRecord>();
    for (const diff of sanitizedDiffs) {
      const existing = dedupedByDiffId.get(diff.id);
      if (!existing) {
        dedupedByDiffId.set(diff.id, diff);
        continue;
      }

      if (diff.createdAt > existing.createdAt) {
        dedupedByDiffId.set(diff.id, diff);
      }
    }

    return {
      diffs: Array.from(dedupedByDiffId.values()),
    };
  } catch {
    return { diffs: [] };
  }
}

function persistState(state: DiffStoreState) {
  inMemoryState.diffs = [...state.diffs];
  const storage = getStorage();
  if (!storage) {
    return;
  }
  safeSetItem(storage, STORAGE_KEY, JSON.stringify(state));
}

function createDiffPatch(previousSnapshot: string, nextSnapshot: string) {
  const patches = dmp.patch_make(previousSnapshot, nextSnapshot);
  return dmp.patch_toText(patches);
}

function normalizeDiffUserId(userId: unknown) {
  const normalizedUserId = typeof userId === "string" ? userId.trim() : undefined;
  if (
    !normalizedUserId ||
    normalizedUserId.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedUserId)
  ) {
    return DEFAULT_LOCAL_USER_ID;
  }

  return normalizedUserId;
}

function normalizeDiffReferenceId(diffId: unknown) {
  const normalizedDiffId = typeof diffId === "string" ? diffId.trim() : undefined;
  if (
    !normalizedDiffId ||
    normalizedDiffId.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedDiffId)
  ) {
    return undefined;
  }

  return normalizedDiffId;
}

export function createDiff(params: unknown) {
  const candidate =
    params && typeof params === "object"
      ? (params as {
          documentId?: unknown;
          userId?: unknown;
          snapshotAfter?: unknown;
          source?: unknown;
          aiPrompt?: unknown;
          aiModel?: unknown;
          previousSnapshot?: unknown;
        })
      : undefined;
  if (!candidate) {
    return null;
  }

  const documentId = safeReadCreateDiffField(candidate, "documentId");
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const source = safeReadCreateDiffField(candidate, "source");
  const snapshotAfter = safeReadCreateDiffField(candidate, "snapshotAfter");
  const normalizedSource =
    source === "manual" ||
    source === "created" ||
    source === "ai"
      ? source
      : undefined;
  if (
    !isValidDocumentId(normalizedDocumentId) ||
    !isValidDocumentContentJson(snapshotAfter) ||
    !normalizedSource ||
    !ALLOWED_SOURCES.has(normalizedSource)
  ) {
    return null;
  }
  const aiPrompt = safeReadCreateDiffField(candidate, "aiPrompt");
  const aiModel = safeReadCreateDiffField(candidate, "aiModel");
  const normalizedMetadata = normalizeDiffMetadata(aiPrompt, aiModel);
  if (!normalizedMetadata) {
    return null;
  }

  const state = loadState();
  const previousSnapshotValue = safeReadCreateDiffField(candidate, "previousSnapshot");
  const previousSnapshot = resolvePreviousSnapshot({
    state,
    documentId: normalizedDocumentId,
    previousSnapshot:
      typeof previousSnapshotValue === "string"
        ? previousSnapshotValue
        : undefined,
  });

  const patch = createDiffPatch(previousSnapshot, snapshotAfter);
  const userId = safeReadCreateDiffField(candidate, "userId");
  const diffRecord: DiffRecord = {
    id: generateLocalId(),
    documentId: normalizedDocumentId,
    userId: normalizeDiffUserId(userId),
    patch,
    snapshotAfter,
    source: normalizedSource,
    aiPrompt: normalizedMetadata.aiPrompt,
    aiModel: normalizedMetadata.aiModel,
    createdAt: safeNow(),
  };

  state.diffs = [diffRecord, ...state.diffs];
  persistState(state);
  return diffRecord;
}

export function listDiffsByDocument(documentId: unknown) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return [];

  return loadState()
    .diffs.filter((diff) => diff.documentId === normalizedDocumentId)
    .sort((a, b) =>
      b.createdAt === a.createdAt
        ? a.id.localeCompare(b.id)
        : b.createdAt - a.createdAt,
    );
}

export function ensureCreatedDiff(params: {
  documentId: string;
  snapshot: string;
  userId?: string;
}) {
  const existing = listDiffsByDocument(params.documentId);
  const existingCreatedDiff = existing.find((diff) => diff.source === "created");
  if (existingCreatedDiff) {
    return existingCreatedDiff;
  }

  return createDiff({
    documentId: params.documentId,
    userId: params.userId ?? DEFAULT_LOCAL_USER_ID,
    snapshotAfter: params.snapshot,
    source: "created",
  }) ?? undefined;
}

export function restoreVersion(params: {
  documentId: string;
  snapshot: string;
  userId?: string;
}) {
  const normalizedDocumentId = normalizeDocumentId(params.documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return { restored: false as const, reason: "invalid_document_id" as const };
  }
  if (!isValidDocumentContentJson(params.snapshot)) {
    return { restored: false as const, reason: "invalid_snapshot" as const };
  }

  const document = getDocumentById(normalizedDocumentId);
  if (!document) {
    return { restored: false as const, reason: "missing_document" as const };
  }

  const now = safeNow();
  const previousSnapshot = document.content;
  updateDocumentContent(normalizedDocumentId, params.snapshot);
  setDocumentLastDiffAt(normalizedDocumentId, now);
  const diff = createDiff({
    documentId: normalizedDocumentId,
    userId: params.userId ?? DEFAULT_LOCAL_USER_ID,
    snapshotAfter: params.snapshot,
    source: "manual",
    previousSnapshot,
  });
  if (!diff) {
    return { restored: false as const, reason: "invalid_snapshot" as const };
  }

  return { restored: true as const, diffId: diff.id };
}

export function triggerIdleSave(params: {
  documentId: string;
  snapshot: string;
  dedupWindowMs?: number;
}) {
  const normalizedDocumentId = normalizeDocumentId(params.documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return { skipped: true, reason: "invalid_document_id" as const };
  }
  if (!isValidDocumentContentJson(params.snapshot)) {
    return { skipped: true, reason: "invalid_snapshot" as const };
  }

  const dedupWindowMs =
    typeof params.dedupWindowMs === "number" &&
    Number.isFinite(params.dedupWindowMs) &&
    params.dedupWindowMs >= 0
      ? params.dedupWindowMs
      : 4000;
  const now = safeNow();
  const document = getDocumentById(normalizedDocumentId);
  if (!document) {
    return { skipped: true, reason: "missing_document" as const };
  }

  if (
    typeof document.lastDiffAt === "number" &&
    now - document.lastDiffAt < dedupWindowMs
  ) {
    return { skipped: true, reason: "dedup_window" as const };
  }

  const previousSnapshot =
    listDiffsByDocument(normalizedDocumentId)[0]?.snapshotAfter ?? document.content;

  if (previousSnapshot === params.snapshot) {
    setDocumentLastDiffAt(normalizedDocumentId, now);
    return { skipped: true, reason: "no_change" as const };
  }

  updateDocumentContent(normalizedDocumentId, params.snapshot);
  setDocumentLastDiffAt(normalizedDocumentId, now);
  const diff = createDiff({
    documentId: normalizedDocumentId,
    userId: DEFAULT_LOCAL_USER_ID,
    snapshotAfter: params.snapshot,
    source: "manual",
    previousSnapshot,
  });
  if (!diff) {
    return { skipped: true, reason: "invalid_snapshot" as const };
  }

  return { skipped: false, diffId: diff.id };
}

export function resetDiffsForTests() {
  inMemoryState.diffs = [];
  persistState({ diffs: [] });
}

function normalizeDiffMetadata(aiPrompt: unknown, aiModel: unknown) {
  const normalizedPrompt = typeof aiPrompt === "string" ? aiPrompt.trim() : "";
  const normalizedModel = typeof aiModel === "string" ? aiModel.trim() : "";
  const hasInvalidPrompt =
    normalizedPrompt.length > MAX_PROMPT_LENGTH ||
    hasDisallowedTextControlChars(normalizedPrompt);
  const hasInvalidModel = hasControlChars(normalizedModel);
  if (hasInvalidPrompt || hasInvalidModel) {
    return null;
  }

  return {
    aiPrompt: normalizedPrompt.length > 0 ? normalizedPrompt : undefined,
    aiModel: normalizedModel.length > 0 ? safeNormalizeModelId(normalizedModel) : undefined,
  };
}

function getLatestDiffByDocumentFromState(
  state: DiffStoreState,
  documentId: string,
) {
  let latestDiff: DiffRecord | undefined;
  for (const diff of state.diffs) {
    if (diff.documentId !== documentId) {
      continue;
    }

    if (!latestDiff) {
      latestDiff = diff;
      continue;
    }

    if (diff.createdAt > latestDiff.createdAt) {
      latestDiff = diff;
      continue;
    }

    if (
      diff.createdAt === latestDiff.createdAt &&
      diff.id.localeCompare(latestDiff.id) < 0
    ) {
      latestDiff = diff;
    }
  }

  return latestDiff;
}

function resolvePreviousSnapshot(params: {
  state: DiffStoreState;
  documentId: string;
  previousSnapshot?: string;
}) {
  if (
    params.previousSnapshot &&
    isValidDocumentContentJson(params.previousSnapshot)
  ) {
    return params.previousSnapshot;
  }

  const latestDiff = getLatestDiffByDocumentFromState(params.state, params.documentId);
  if (latestDiff) {
    return latestDiff.snapshotAfter;
  }

  const currentDocument = getDocumentById(params.documentId);
  if (currentDocument && isValidDocumentContentJson(currentDocument.content)) {
    return currentDocument.content;
  }

  return JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
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

function safeReadCreateDiffField(
  params: {
    documentId?: unknown;
    userId?: unknown;
    snapshotAfter?: unknown;
    source?: unknown;
    aiPrompt?: unknown;
    aiModel?: unknown;
    previousSnapshot?: unknown;
  },
  key:
    | "documentId"
    | "userId"
    | "snapshotAfter"
    | "source"
    | "aiPrompt"
    | "aiModel"
    | "previousSnapshot",
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

function safeNormalizeModelId(modelId: string) {
  try {
    return getModelConfig(modelId).id;
  } catch {
    return undefined;
  }
}
