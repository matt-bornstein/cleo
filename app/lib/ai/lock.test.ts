import { AILockManager } from "@/lib/ai/lock";

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
});
