import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { filterStalePresence, usePresence } from "@/hooks/usePresence";

const {
  listPresenceMock,
  removePresenceMock,
  updatePresenceMock,
} = vi.hoisted(() => ({
  listPresenceMock: vi.fn(),
  removePresenceMock: vi.fn(),
  updatePresenceMock: vi.fn(),
}));

vi.mock("@/lib/presence/store", () => ({
  listPresence: listPresenceMock,
  removePresence: removePresenceMock,
  updatePresence: updatePresenceMock,
}));

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

describe("usePresence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listPresenceMock.mockReset();
    removePresenceMock.mockReset();
    updatePresenceMock.mockReset();
    listPresenceMock.mockReturnValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not heartbeat when document id is blank or whitespace", () => {
    const { result } = renderHook(() => usePresence("   "));

    act(() => {
      result.current.updateMyPresence({ name: "Me", color: "#000" });
    });

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(updatePresenceMock).not.toHaveBeenCalled();
    expect(listPresenceMock).not.toHaveBeenCalled();
  });

  it("normalizes document id for presence list and heartbeat updates", () => {
    renderHook(() => usePresence("  doc-presence  "));

    expect(listPresenceMock).toHaveBeenCalledWith("doc-presence");

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(updatePresenceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-presence",
      }),
    );
  });
});
