import { filterStalePresence } from "@/hooks/usePresence";

describe("filterStalePresence", () => {
  it("removes stale presence entries older than 10 seconds", () => {
    const now = 100_000;
    const entries = [
      { id: "fresh", updatedAt: now - 1_000 },
      { id: "stale", updatedAt: now - 15_000 },
    ];

    const active = filterStalePresence(entries, now, 10_000);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("fresh");
  });
});
