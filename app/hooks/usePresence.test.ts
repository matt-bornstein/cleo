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

  it("normalizes malformed now/maxAge values and ignores malformed entry timestamps", () => {
    const entries = [
      { id: "fresh", updatedAt: 5_000 },
      { id: "negative", updatedAt: -1 },
      { id: "nan", updatedAt: Number.NaN },
    ];

    const active = filterStalePresence(entries, Number.NaN, Number.NaN);
    expect(active).toEqual([{ id: "fresh", updatedAt: 5_000 }]);
  });

  it("filters out entries with timestamps too far in the future", () => {
    const now = 10_000;
    const entries = [
      { id: "near-future", updatedAt: now + 2_000 },
      { id: "far-future", updatedAt: now + 20_000 },
    ];

    const active = filterStalePresence(entries, now, 10_000);
    expect(active).toEqual([{ id: "near-future", updatedAt: now + 2_000 }]);
  });

  it("returns empty array for malformed non-array entries input", () => {
    const active = filterStalePresence("bad" as unknown as Array<{ updatedAt: number }>, 10_000);
    expect(active).toEqual([]);
  });

  it("ignores malformed null and non-numeric entries inside presence arrays", () => {
    const active = filterStalePresence(
      [
        null,
        { id: "bad-type", updatedAt: "bad" },
        { id: "valid", updatedAt: 9_000 },
      ] as unknown as Array<{ id: string; updatedAt: number }>,
      10_000,
      10_000,
    );

    expect(active).toEqual([{ id: "valid", updatedAt: 9_000 }]);
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

  it("does not heartbeat when document id is invalid", () => {
    const { result } = renderHook(() => usePresence("doc-\ninvalid"));

    act(() => {
      result.current.updateMyPresence({ name: "Me", color: "#000" });
      vi.advanceTimersByTime(15_000);
    });

    expect(updatePresenceMock).not.toHaveBeenCalled();
    expect(listPresenceMock).not.toHaveBeenCalled();
  });

  it("does not heartbeat when document id is malformed non-string", () => {
    const { result } = renderHook(() => usePresence(123 as unknown as string));

    act(() => {
      result.current.updateMyPresence({ name: "Me", color: "#000" });
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

  it("normalizes malformed non-object update payloads before dispatch", () => {
    const { result } = renderHook(() => usePresence("doc-presence"));
    updatePresenceMock.mockClear();

    act(() => {
      result.current.updateMyPresence(123 as unknown as { name: string; color: string });
    });

    expect(updatePresenceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-presence",
        data: expect.objectContaining({
          name: "You",
          color: "#3b82f6",
        }),
      }),
    );
  });
});
