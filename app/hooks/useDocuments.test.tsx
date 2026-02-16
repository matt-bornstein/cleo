import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useDocuments } from "@/hooks/useDocuments";

const {
  createDocumentMock,
  deleteDocumentMock,
  getDocumentByIdMock,
  listDocumentsMock,
  setDocumentChatClearedAtMock,
  updateDocumentContentMock,
  updateDocumentTitleMock,
  hasDocumentAccessMock,
} = vi.hoisted(() => ({
  createDocumentMock: vi.fn(),
  deleteDocumentMock: vi.fn(),
  getDocumentByIdMock: vi.fn(),
  listDocumentsMock: vi.fn(),
  setDocumentChatClearedAtMock: vi.fn(),
  updateDocumentContentMock: vi.fn(),
  updateDocumentTitleMock: vi.fn(),
  hasDocumentAccessMock: vi.fn(),
}));

vi.mock("@/lib/documents/store", () => ({
  createDocument: createDocumentMock,
  deleteDocument: deleteDocumentMock,
  getDocumentById: getDocumentByIdMock,
  listDocuments: listDocumentsMock,
  setDocumentChatClearedAt: setDocumentChatClearedAtMock,
  updateDocumentContent: updateDocumentContentMock,
  updateDocumentTitle: updateDocumentTitleMock,
}));

vi.mock("@/lib/permissions/store", () => ({
  hasDocumentAccess: hasDocumentAccessMock,
}));

describe("useDocuments", () => {
  beforeEach(() => {
    createDocumentMock.mockReset();
    deleteDocumentMock.mockReset();
    getDocumentByIdMock.mockReset();
    listDocumentsMock.mockReset();
    setDocumentChatClearedAtMock.mockReset();
    updateDocumentContentMock.mockReset();
    updateDocumentTitleMock.mockReset();
    hasDocumentAccessMock.mockReset();

    listDocumentsMock.mockReturnValue([]);
    hasDocumentAccessMock.mockReturnValue(true);
  });

  it("filters documents by access checks", () => {
    listDocumentsMock.mockReturnValue([
      {
        id: "doc-allowed",
        title: "Allowed",
        content: "{}",
        ownerEmail: "owner@example.com",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "doc-blocked",
        title: "Blocked",
        content: "{}",
        ownerEmail: "owner@example.com",
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    hasDocumentAccessMock.mockImplementation((documentId: string) => documentId === "doc-allowed");

    const { result } = renderHook(() => useDocuments(undefined, "me@example.com"));
    expect(result.current.documents).toHaveLength(1);
    expect(result.current.documents[0]?.id).toBe("doc-allowed");
  });

  it("normalizes malformed non-string search values before listing documents", () => {
    renderHook(() => useDocuments(123 as unknown as string, "me@example.com"));
    expect(listDocumentsMock).toHaveBeenCalledWith(undefined);
  });

  it("falls back to default email for malformed current user identities", () => {
    listDocumentsMock.mockReturnValue([
      {
        id: "doc-allowed",
        title: "Allowed",
        content: "{}",
        ownerEmail: "owner@example.com",
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    hasDocumentAccessMock.mockReturnValue(true);

    renderHook(() => useDocuments(undefined, "bad\nemail"));

    expect(hasDocumentAccessMock).toHaveBeenCalledWith(
      "doc-allowed",
      "me@local.dev",
      "owner@example.com",
    );

    hasDocumentAccessMock.mockClear();
    renderHook(() => useDocuments(undefined, "not-an-email"));
    expect(hasDocumentAccessMock).toHaveBeenCalledWith(
      "doc-allowed",
      "me@local.dev",
      "owner@example.com",
    );

    hasDocumentAccessMock.mockClear();
    renderHook(() => useDocuments(undefined, 123 as unknown as string));
    expect(hasDocumentAccessMock).toHaveBeenCalledWith(
      "doc-allowed",
      "me@local.dev",
      "owner@example.com",
    );
  });

  it("refreshes list only when updates or removals succeed", () => {
    const { result } = renderHook(() => useDocuments(undefined, "me@example.com"));
    expect(listDocumentsMock).toHaveBeenCalledTimes(1);

    updateDocumentTitleMock.mockReturnValue(undefined);
    updateDocumentContentMock.mockReturnValue(undefined);
    setDocumentChatClearedAtMock.mockReturnValue(undefined);
    deleteDocumentMock.mockReturnValue(false);

    act(() => {
      result.current.updateTitle("missing", "Nope");
      result.current.updateContent("missing", "{}");
      result.current.setChatClearedAt("missing", 1);
      result.current.remove("missing");
    });

    expect(listDocumentsMock).toHaveBeenCalledTimes(1);

    updateDocumentTitleMock.mockReturnValue({ id: "doc-1" });
    updateDocumentContentMock.mockReturnValue({ id: "doc-1" });
    setDocumentChatClearedAtMock.mockReturnValue({ id: "doc-1" });
    deleteDocumentMock.mockReturnValue(true);

    act(() => {
      result.current.updateTitle("doc-1", "Updated");
    });
    expect(listDocumentsMock).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.updateContent("doc-1", "{}");
    });
    expect(listDocumentsMock).toHaveBeenCalledTimes(3);

    act(() => {
      result.current.setChatClearedAt("doc-1", 2);
    });
    expect(listDocumentsMock).toHaveBeenCalledTimes(4);

    act(() => {
      result.current.remove("doc-1");
    });

    expect(listDocumentsMock).toHaveBeenCalledTimes(5);
  });

  it("normalizes malformed non-string operation payloads before dispatch", () => {
    const { result } = renderHook(() => useDocuments(undefined, "me@example.com"));

    act(() => {
      result.current.getById(123 as unknown as string);
      result.current.updateTitle(123 as unknown as string, 456 as unknown as string);
      result.current.updateContent(123 as unknown as string, 456 as unknown as string);
      result.current.setChatClearedAt(123 as unknown as string, "bad" as unknown as number);
      result.current.remove(123 as unknown as string);
      result.current.create(123 as unknown as string, 456 as unknown as string);
    });

    expect(getDocumentByIdMock).toHaveBeenCalledWith("");
    expect(updateDocumentTitleMock).toHaveBeenCalledWith("", "");
    expect(updateDocumentContentMock).toHaveBeenCalledWith("", "");
    expect(setDocumentChatClearedAtMock).toHaveBeenCalledWith("", Number.NaN);
    expect(deleteDocumentMock).toHaveBeenCalledWith("");
    expect(createDocumentMock).toHaveBeenCalledWith("", undefined);
  });

  it("falls back safely when document list or access checks throw", () => {
    listDocumentsMock.mockImplementation(() => {
      throw new Error("list failed");
    });

    const { result, rerender } = renderHook(() =>
      useDocuments(undefined, "me@example.com"),
    );
    expect(result.current.documents).toEqual([]);

    listDocumentsMock.mockReturnValue([
      {
        id: "doc-1",
        title: "Doc",
        content: "{}",
        ownerEmail: "owner@example.com",
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    hasDocumentAccessMock.mockImplementation(() => {
      throw new Error("access failed");
    });
    rerender();

    expect(result.current.documents).toEqual([]);
  });

  it("does not throw when document store operations fail", () => {
    createDocumentMock.mockImplementation(() => {
      throw new Error("create failed");
    });
    getDocumentByIdMock.mockImplementation(() => {
      throw new Error("get failed");
    });
    updateDocumentTitleMock.mockImplementation(() => {
      throw new Error("title failed");
    });
    updateDocumentContentMock.mockImplementation(() => {
      throw new Error("content failed");
    });
    setDocumentChatClearedAtMock.mockImplementation(() => {
      throw new Error("chat failed");
    });
    deleteDocumentMock.mockImplementation(() => {
      throw new Error("delete failed");
    });

    const { result } = renderHook(() => useDocuments(undefined, "me@example.com"));

    expect(() => {
      act(() => {
        expect(result.current.create("Title", "owner@example.com")).toBeNull();
        expect(result.current.getById("doc-1")).toBeUndefined();
        expect(result.current.updateTitle("doc-1", "Title")).toBeUndefined();
        expect(result.current.updateContent("doc-1", "{}")).toBeUndefined();
        expect(result.current.setChatClearedAt("doc-1", 1)).toBeUndefined();
        expect(result.current.remove("doc-1")).toBe(false);
      });
    }).not.toThrow();
  });

  it("skips documents when document id getter throws", () => {
    const documentWithThrowingId = Object.create(null) as { id: unknown };
    Object.defineProperty(documentWithThrowingId, "id", {
      get() {
        throw new Error("id getter failed");
      },
    });
    listDocumentsMock.mockReturnValue([documentWithThrowingId]);

    const { result } = renderHook(() => useDocuments(undefined, "me@example.com"));
    expect(result.current.documents).toEqual([]);
  });

  it("normalizes listed documents when field getters throw", () => {
    const documentWithThrowingFields = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(documentWithThrowingFields, "id", {
      value: "doc-getter-safe",
    });
    Object.defineProperty(documentWithThrowingFields, "title", {
      get() {
        throw new Error("title getter failed");
      },
    });
    Object.defineProperty(documentWithThrowingFields, "content", {
      get() {
        throw new Error("content getter failed");
      },
    });
    Object.defineProperty(documentWithThrowingFields, "ownerEmail", {
      get() {
        throw new Error("ownerEmail getter failed");
      },
    });
    Object.defineProperty(documentWithThrowingFields, "createdAt", {
      get() {
        throw new Error("createdAt getter failed");
      },
    });
    Object.defineProperty(documentWithThrowingFields, "updatedAt", {
      get() {
        throw new Error("updatedAt getter failed");
      },
    });
    listDocumentsMock.mockReturnValue([documentWithThrowingFields]);
    hasDocumentAccessMock.mockReturnValue(true);

    const { result } = renderHook(() => useDocuments(undefined, "me@example.com"));
    expect(result.current.documents).toEqual([
      expect.objectContaining({
        id: "doc-getter-safe",
        title: "Untitled",
        ownerEmail: "me@local.dev",
        createdAt: 0,
        updatedAt: 0,
      }),
    ]);
    expect(result.current.documents[0]?.content).toContain('"type":"doc"');
  });

  it("drops listed documents with control characters in ids", () => {
    listDocumentsMock.mockReturnValue([
      {
        id: "doc-\ninvalid",
        title: "Bad",
        content: "{}",
        ownerEmail: "owner@example.com",
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    hasDocumentAccessMock.mockReturnValue(true);

    const { result } = renderHook(() => useDocuments(undefined, "me@example.com"));
    expect(result.current.documents).toEqual([]);
  });

  it("returns safe fallbacks when document operation return payload getters throw", () => {
    const malformedOperationDocument = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(malformedOperationDocument, "id", {
      get() {
        throw new Error("id getter failed");
      },
    });
    createDocumentMock.mockReturnValue(malformedOperationDocument);
    getDocumentByIdMock.mockReturnValue(malformedOperationDocument);
    updateDocumentTitleMock.mockReturnValue(malformedOperationDocument);
    updateDocumentContentMock.mockReturnValue(malformedOperationDocument);
    setDocumentChatClearedAtMock.mockReturnValue(malformedOperationDocument);

    const { result } = renderHook(() => useDocuments(undefined, "me@example.com"));
    expect(listDocumentsMock).toHaveBeenCalledTimes(1);

    expect(() => {
      act(() => {
        expect(result.current.create("Title", "owner@example.com")).toBeNull();
        expect(result.current.getById("doc-1")).toBeUndefined();
        expect(result.current.updateTitle("doc-1", "Next")).toBeUndefined();
        expect(result.current.updateContent("doc-1", "{}")).toBeUndefined();
        expect(result.current.setChatClearedAt("doc-1", 1)).toBeUndefined();
      });
    }).not.toThrow();
    expect(listDocumentsMock).toHaveBeenCalledTimes(1);
  });

  it("returns safe fallbacks when operation returns control-char document ids", () => {
    const malformedIdDocument = {
      id: "doc-\ninvalid",
      title: "Title",
      content: "{}",
      ownerEmail: "owner@example.com",
      createdAt: 1,
      updatedAt: 1,
    };
    createDocumentMock.mockReturnValue(malformedIdDocument);
    getDocumentByIdMock.mockReturnValue(malformedIdDocument);
    updateDocumentTitleMock.mockReturnValue(malformedIdDocument);
    updateDocumentContentMock.mockReturnValue(malformedIdDocument);
    setDocumentChatClearedAtMock.mockReturnValue(malformedIdDocument);

    const { result } = renderHook(() => useDocuments(undefined, "me@example.com"));
    expect(listDocumentsMock).toHaveBeenCalledTimes(1);

    act(() => {
      expect(result.current.create("Title", "owner@example.com")).toBeNull();
      expect(result.current.getById("doc-1")).toBeUndefined();
      expect(result.current.updateTitle("doc-1", "Next")).toBeUndefined();
      expect(result.current.updateContent("doc-1", "{}")).toBeUndefined();
      expect(result.current.setChatClearedAt("doc-1", 1)).toBeUndefined();
    });

    expect(listDocumentsMock).toHaveBeenCalledTimes(1);
  });
});
