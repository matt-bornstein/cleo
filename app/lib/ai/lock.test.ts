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
});
