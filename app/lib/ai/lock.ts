import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { normalizeAIUserId } from "@/lib/ai/identity";

export type LockResult =
  | { acquired: true }
  | { acquired: false; reason: string };

function normalizeStaleAfterMs(value: unknown, fallback = 120_000) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return value;
}

export class AILockManager {
  private locks = new Map<string, { lockedBy: string; lockedAt: number }>();

  acquire(documentId: string, userId: string, staleAfterMs: unknown = 120_000): LockResult {
    const normalizedDocumentId = normalizeDocumentId(documentId);
    if (!isValidDocumentId(normalizedDocumentId)) {
      return {
        acquired: false,
        reason: "Document is unavailable.",
      };
    }

    const normalizedUserId = normalizeAIUserId(userId);
    const staleWindowMs = normalizeStaleAfterMs(staleAfterMs);
    const now = Math.max(0, Date.now());
    const existing = this.locks.get(normalizedDocumentId);

    if (
      existing &&
      existing.lockedBy !== normalizedUserId &&
      now - existing.lockedAt < staleWindowMs
    ) {
      return {
        acquired: false,
        reason: `AI is already processing a request from ${existing.lockedBy}.`,
      };
    }

    this.locks.set(normalizedDocumentId, {
      lockedAt: now,
      lockedBy: normalizedUserId,
    });
    return { acquired: true };
  }

  release(documentId: string, userId: string) {
    const normalizedDocumentId = normalizeDocumentId(documentId);
    if (!isValidDocumentId(normalizedDocumentId)) return;

    const normalizedUserId = normalizeAIUserId(userId);
    const existing = this.locks.get(normalizedDocumentId);
    if (!existing) return;
    if (existing.lockedBy !== normalizedUserId) return;
    this.locks.delete(normalizedDocumentId);
  }

  getStatus(documentId: string, staleAfterMs: unknown = 120_000) {
    const normalizedDocumentId = normalizeDocumentId(documentId);
    if (!isValidDocumentId(normalizedDocumentId)) {
      return { locked: false as const };
    }

    const staleWindowMs = normalizeStaleAfterMs(staleAfterMs);
    const lock = this.locks.get(normalizedDocumentId);
    if (!lock) {
      return { locked: false as const };
    }

    const isStale = Math.max(0, Date.now()) - lock.lockedAt >= staleWindowMs;
    if (isStale) {
      this.locks.delete(normalizedDocumentId);
      return { locked: false as const };
    }

    return {
      locked: true as const,
      lockedBy: lock.lockedBy,
      lockedAt: lock.lockedAt,
    };
  }
}

export const aiLockManager = new AILockManager();
