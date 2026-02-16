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
import { hasControlChars } from "@/lib/validators/controlChars";

const STORAGE_KEY = "plan00.diffs.v1";
const dmp = new diff_match_patch();
const DISALLOWED_PROMPT_CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

type DiffStoreState = {
  diffs: DiffRecord[];
};

const inMemoryState: DiffStoreState = {
  diffs: [],
};
const ALLOWED_SOURCES = new Set<DiffSource>(["manual", "created", "ai"]);

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
    if (!parsed.diffs) {
      return { diffs: [] };
    }

    const sanitizedDiffs = parsed.diffs.flatMap((diff) => {
      const normalizedDocumentId = normalizeDocumentId(diff.documentId);
      const normalizedDiffId = normalizeDiffReferenceId(diff.id);
      const normalizedMetadata = normalizeDiffMetadata(diff.aiPrompt, diff.aiModel);
      if (
        !normalizedDiffId ||
        !isValidDocumentId(normalizedDocumentId) ||
        !ALLOWED_SOURCES.has(diff.source) ||
        !normalizedMetadata ||
        typeof diff.patch !== "string" ||
        !isValidDocumentContentJson(diff.snapshotAfter) ||
        typeof diff.createdAt !== "number" ||
        !Number.isFinite(diff.createdAt) ||
        diff.createdAt < 0
      ) {
        return [];
      }

      return [
        {
          ...diff,
          id: normalizedDiffId,
          documentId: normalizedDocumentId,
          userId: normalizeDiffUserId(diff.userId),
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

function normalizeDiffUserId(userId: string | undefined) {
  const normalizedUserId = userId?.trim();
  if (
    !normalizedUserId ||
    normalizedUserId.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedUserId)
  ) {
    return DEFAULT_LOCAL_USER_ID;
  }

  return normalizedUserId;
}

function normalizeDiffReferenceId(diffId: string | undefined) {
  const normalizedDiffId = diffId?.trim();
  if (
    !normalizedDiffId ||
    normalizedDiffId.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedDiffId)
  ) {
    return undefined;
  }

  return normalizedDiffId;
}

export function createDiff(params: {
  documentId: string;
  userId: string;
  snapshotAfter: string;
  source: DiffSource;
  aiPrompt?: string;
  aiModel?: string;
}) {
  const normalizedDocumentId = normalizeDocumentId(params.documentId);
  if (
    !isValidDocumentId(normalizedDocumentId) ||
    !isValidDocumentContentJson(params.snapshotAfter) ||
    !ALLOWED_SOURCES.has(params.source)
  ) {
    return null;
  }
  const normalizedMetadata = normalizeDiffMetadata(params.aiPrompt, params.aiModel);
  if (!normalizedMetadata) {
    return null;
  }

  const state = loadState();
  const previousSnapshot =
    getLatestDiffByDocumentFromState(state, normalizedDocumentId)?.snapshotAfter ??
    JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

  const patch = createDiffPatch(previousSnapshot, params.snapshotAfter);
  const diffRecord: DiffRecord = {
    id: crypto.randomUUID(),
    documentId: normalizedDocumentId,
    userId: normalizeDiffUserId(params.userId),
    patch,
    snapshotAfter: params.snapshotAfter,
    source: params.source,
    aiPrompt: normalizedMetadata.aiPrompt,
    aiModel: normalizedMetadata.aiModel,
    createdAt: Date.now(),
  };

  state.diffs = [diffRecord, ...state.diffs];
  persistState(state);
  return diffRecord;
}

export function listDiffsByDocument(documentId: string) {
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

  const now = Date.now();
  updateDocumentContent(normalizedDocumentId, params.snapshot);
  setDocumentLastDiffAt(normalizedDocumentId, now);
  const diff = createDiff({
    documentId: normalizedDocumentId,
    userId: params.userId ?? DEFAULT_LOCAL_USER_ID,
    snapshotAfter: params.snapshot,
    source: "manual",
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
  const now = Date.now();
  const document = getDocumentById(normalizedDocumentId);
  if (!document) {
    return { skipped: true, reason: "missing_document" as const };
  }

  if (document.lastDiffAt && now - document.lastDiffAt < dedupWindowMs) {
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
  });
  if (!diff) {
    return { skipped: true, reason: "invalid_snapshot" as const };
  }

  return { skipped: false, diffId: diff.id };
}

export function resetDiffsForTests() {
  persistState({ diffs: [] });
}

function normalizeDiffMetadata(aiPrompt: unknown, aiModel: unknown) {
  const normalizedPrompt = typeof aiPrompt === "string" ? aiPrompt.trim() : "";
  const normalizedModel = typeof aiModel === "string" ? aiModel.trim() : "";
  const hasInvalidPrompt =
    normalizedPrompt.length > MAX_PROMPT_LENGTH ||
    DISALLOWED_PROMPT_CONTROL_CHARS_REGEX.test(normalizedPrompt);
  const hasInvalidModel = hasControlChars(normalizedModel);
  if (hasInvalidPrompt || hasInvalidModel) {
    return null;
  }

  return {
    aiPrompt: normalizedPrompt.length > 0 ? normalizedPrompt : undefined,
    aiModel: normalizedModel.length > 0 ? getModelConfig(normalizedModel).id : undefined,
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
