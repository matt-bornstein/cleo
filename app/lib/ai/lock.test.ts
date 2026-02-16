import { AILockManager } from "@/lib/ai/lock";
import { vi } from "vitest";

describe("AILockManager", () => {
  it("acquires and releases lock for same user", () => {
    const manager = new AILockManager();

    const acquire = manager.acquire("doc-1", "alice");
    expect(acquire).toEqual({ acquired: true });

    manager.release("doc-1", "alice");
    const acquireAgain = manager.acquire("doc-1", "alice");
    expect(acquireAgain).toEqual({ acquired: true });
  });

  it("blocks other users while lock is fresh", () => {
    const manager = new AILockManager();
    manager.acquire("doc-2", "alice");

    const blocked = manager.acquire("doc-2", "bob");
    expect(blocked.acquired).toBe(false);
    if (!blocked.acquired) {
      expect(blocked.reason).toContain("alice");
    }
  });

  it("does not release a lock for different user id", () => {
    const manager = new AILockManager();
    manager.acquire("doc-2b", "alice");

    manager.release("doc-2b", "bob");

    const stillLocked = manager.acquire("doc-2b", "carol");
    expect(stillLocked.acquired).toBe(false);
    if (!stillLocked.acquired) {
      expect(stillLocked.reason).toContain("alice");
    }
  });

  it("returns lock status and clears stale locks", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000);
    const manager = new AILockManager();
    manager.acquire("doc-3", "alice");

    const activeStatus = manager.getStatus("doc-3", 120_000);
    expect(activeStatus).toEqual({
      locked: true,
      lockedBy: "alice",
      lockedAt: 1_000,
    });

    nowSpy.mockReturnValue(200_000);
    const staleStatus = manager.getStatus("doc-3", 120_000);
    expect(staleStatus).toEqual({ locked: false });
    expect(manager.getStatus("doc-3", 120_000)).toEqual({ locked: false });
    nowSpy.mockRestore();
  });

  it("allows takeover when lock becomes stale", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000);
    const manager = new AILockManager();
    manager.acquire("doc-4", "alice", 100);

    nowSpy.mockReturnValue(2_000);
    const takeover = manager.acquire("doc-4", "bob", 100);
    expect(takeover).toEqual({ acquired: true });
    const status = manager.getStatus("doc-4", 100);
    expect(status).toEqual({
      locked: true,
      lockedBy: "bob",
      lockedAt: 2_000,
    });
    nowSpy.mockRestore();
  });

  it("normalizes document and user identifiers for lock lifecycle", () => {
    const manager = new AILockManager();
    expect(manager.acquire("  doc-trim  ", "  alice  ")).toEqual({ acquired: true });

    expect(manager.getStatus("doc-trim")).toEqual({
      locked: true,
      lockedBy: "alice",
      lockedAt: expect.any(Number),
    });

    manager.release(" doc-trim ", "alice");
    expect(manager.getStatus("doc-trim")).toEqual({ locked: false });
  });

  it("rejects invalid document ids safely", () => {
    const manager = new AILockManager();
    expect(manager.acquire("doc-\ninvalid", "alice")).toEqual({
      acquired: false,
      reason: "Document is unavailable.",
    });

    expect(manager.getStatus("doc-\ninvalid")).toEqual({ locked: false });
  });

  it("falls back to default stale window for invalid staleAfterMs values", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000);
    const manager = new AILockManager();
    manager.acquire("doc-5", "alice", Number.NaN);

    nowSpy.mockReturnValue(1_500);
    const status = manager.getStatus("doc-5", Number.NaN);
    expect(status).toEqual({
      locked: true,
      lockedBy: "alice",
      lockedAt: 1_000,
    });

    const blocked = manager.acquire("doc-5", "bob", Number.NaN);
    expect(blocked.acquired).toBe(false);

    const blockedFromString = manager.acquire("doc-5", "carol", "1000");
    expect(blockedFromString.acquired).toBe(false);
    nowSpy.mockRestore();
  });

  it("floors lock timestamps at zero for negative system clocks", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(-1000);
    const manager = new AILockManager();

    expect(manager.acquire("doc-6", "alice")).toEqual({ acquired: true });
    expect(manager.getStatus("doc-6")).toEqual({
      locked: true,
      lockedBy: "alice",
      lockedAt: 0,
    });
    nowSpy.mockRestore();
  });

  it("falls back to zero timestamp when Date.now throws", () => {
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now failed");
    });
    const manager = new AILockManager();

    expect(manager.acquire("doc-7", "alice")).toEqual({ acquired: true });
    expect(manager.getStatus("doc-7")).toEqual({
      locked: true,
      lockedBy: "alice",
      lockedAt: 0,
    });

    nowSpy.mockRestore();
  });
});
