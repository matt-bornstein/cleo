import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { useAILockStatus } from "@/hooks/useAILockStatus";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolveFn) => {
    resolve = resolveFn;
  });
  return { promise, resolve };
}

describe("useAILockStatus", () => {
  it("fetches lock status on mount", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ locked: true, lockedBy: "alice" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAILockStatus("doc-hook"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/ai/stream?documentId=doc-hook");
      expect(result.current.locked).toBe(true);
      expect(result.current.lockedBy).toBe("alice");
    });

    vi.unstubAllGlobals();
  });

  it("resets status when lock status request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ locked: true, lockedBy: "alice" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "bad request" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ documentId }) => useAILockStatus(documentId),
      {
        initialProps: { documentId: "doc-hook" },
      },
    );

    await waitFor(() => {
      expect(result.current.locked).toBe(true);
    });

    rerender({ documentId: "doc-hook-2" });

    await waitFor(() => {
      expect(result.current.locked).toBe(false);
      expect(result.current.lockedBy).toBeUndefined();
    });

    vi.unstubAllGlobals();
  });

  it("does not poll when document id is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAILockStatus(""));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ locked: false });

    vi.unstubAllGlobals();
  });

  it("does not poll when document id contains only whitespace", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAILockStatus("   "));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ locked: false });

    vi.unstubAllGlobals();
  });

  it("does not poll when document id exceeds max length", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAILockStatus("d".repeat(257)));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ locked: false });

    vi.unstubAllGlobals();
  });

  it("does not poll when document id contains control characters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAILockStatus("doc-\ninvalid"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ locked: false });

    vi.unstubAllGlobals();
  });

  it("trims document id before lock status fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ locked: true, lockedBy: "alice" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAILockStatus("  doc-trimmed  "));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/ai/stream?documentId=doc-trimmed");
      expect(result.current.locked).toBe(true);
      expect(result.current.lockedBy).toBe("alice");
    });

    vi.unstubAllGlobals();
  });

  it("returns unlocked immediately when switching to another document", async () => {
    const deferredDoc2 = createDeferred<{
      ok: boolean;
      json: () => Promise<{ locked: boolean; lockedBy?: string }>;
    }>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ locked: true, lockedBy: "alice" }),
      })
      .mockReturnValueOnce(deferredDoc2.promise);

    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ documentId }) => useAILockStatus(documentId),
      {
        initialProps: { documentId: "doc-one" },
      },
    );

    await waitFor(() => {
      expect(result.current.locked).toBe(true);
    });

    rerender({ documentId: "doc-two" });
    expect(result.current.locked).toBe(false);

    deferredDoc2.resolve({
      ok: true,
      json: async () => ({ locked: true, lockedBy: "bob" }),
    });

    await waitFor(() => {
      expect(result.current.locked).toBe(true);
      expect(result.current.lockedBy).toBe("bob");
    });

    vi.unstubAllGlobals();
  });
});
