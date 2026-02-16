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
});
