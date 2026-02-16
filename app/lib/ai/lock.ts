export type LockResult =
  | { acquired: true }
  | { acquired: false; reason: string };

export class AILockManager {
  private locks = new Map<string, { lockedBy: string; lockedAt: number }>();

  acquire(documentId: string, userId: string, staleAfterMs = 120_000): LockResult {
    const now = Date.now();
    const existing = this.locks.get(documentId);

    if (
      existing &&
      existing.lockedBy !== userId &&
      now - existing.lockedAt < staleAfterMs
    ) {
      return {
        acquired: false,
        reason: `AI is already processing a request from ${existing.lockedBy}.`,
      };
    }

    this.locks.set(documentId, {
      lockedAt: now,
      lockedBy: userId,
    });
    return { acquired: true };
  }

  release(documentId: string, userId: string) {
    const existing = this.locks.get(documentId);
    if (!existing) return;
    if (existing.lockedBy !== userId) return;
    this.locks.delete(documentId);
  }

  getStatus(documentId: string, staleAfterMs = 120_000) {
    const lock = this.locks.get(documentId);
    if (!lock) {
      return { locked: false as const };
    }

    const isStale = Date.now() - lock.lockedAt >= staleAfterMs;
    if (isStale) {
      this.locks.delete(documentId);
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
