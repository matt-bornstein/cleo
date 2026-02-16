import { renderHook } from "@testing-library/react";
import { vi } from "vitest";

import {
  normalizeSyncDocumentId,
  useOptionalTiptapSync,
} from "@/hooks/useOptionalTiptapSync";

const { useTiptapSyncMock } = vi.hoisted(() => ({
  useTiptapSyncMock: vi.fn(),
}));

vi.mock("@convex-dev/prosemirror-sync/tiptap", () => ({
  useTiptapSync: useTiptapSyncMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    prosemirrorSync: {},
  },
}));

describe("useOptionalTiptapSync", () => {
  beforeEach(() => {
    useTiptapSyncMock.mockReset();
    useTiptapSyncMock.mockReturnValue({
      extension: null,
      initialContent: undefined,
      isLoading: false,
    });
  });

  it("normalizes valid document ids before initializing sync", () => {
    renderHook(() => useOptionalTiptapSync("  doc-123  "));

    expect(useTiptapSyncMock).toHaveBeenCalledWith(
      expect.anything(),
      "doc-123",
      { snapshotDebounceMs: 1000 },
    );
  });

  it("falls back to stable invalid-doc id for malformed runtime ids", () => {
    renderHook(() => useOptionalTiptapSync(123));

    expect(useTiptapSyncMock).toHaveBeenCalledWith(
      expect.anything(),
      "__invalid-document-id__",
      { snapshotDebounceMs: 1000 },
    );
  });

  it("exposes document id normalization helper", () => {
    expect(normalizeSyncDocumentId("  doc-good  ")).toBe("doc-good");
    expect(normalizeSyncDocumentId("doc-\nbad")).toBe("__invalid-document-id__");
    expect(normalizeSyncDocumentId(42)).toBe("__invalid-document-id__");
  });

  it("falls back to inert sync state when underlying sync hook throws", () => {
    useTiptapSyncMock.mockImplementation(() => {
      throw new Error("sync unavailable");
    });

    const { result } = renderHook(() => useOptionalTiptapSync("doc-123"));

    expect(result.current).toEqual({
      extension: null,
      initialContent: undefined,
      isLoading: false,
    });
  });
});
