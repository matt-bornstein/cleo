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
});
