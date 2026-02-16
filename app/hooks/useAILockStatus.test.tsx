import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { useAILockStatus } from "@/hooks/useAILockStatus";

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
});
