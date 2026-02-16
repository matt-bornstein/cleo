import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useComments } from "@/hooks/useComments";

const { addCommentMock, listCommentsMock, resolveCommentMock } = vi.hoisted(() => ({
  addCommentMock: vi.fn(),
  listCommentsMock: vi.fn(),
  resolveCommentMock: vi.fn(),
}));

vi.mock("@/lib/comments/store", () => ({
  addComment: addCommentMock,
  listComments: listCommentsMock,
  resolveComment: resolveCommentMock,
}));

describe("useComments", () => {
  beforeEach(() => {
    addCommentMock.mockReset();
    listCommentsMock.mockReset();
    resolveCommentMock.mockReset();
    listCommentsMock.mockReturnValue([]);
  });

  it("passes trimmed current user id when creating root comments", () => {
    const { result } = renderHook(() => useComments("doc-1", "  reviewer@example.com  "));

    act(() => {
      result.current.createComment("Looks good", "Intro");
    });

    expect(addCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        content: "Looks good",
        anchorText: "Intro",
        userId: "reviewer@example.com",
      }),
    );
  });

  it("uses parent anchor text and current user id for replies", () => {
    listCommentsMock.mockReturnValue([
      {
        id: "parent-1",
        documentId: "doc-1",
        userId: "owner@example.com",
        content: "Parent note",
        anchorFrom: 0,
        anchorTo: 0,
        anchorText: "Paragraph 1",
        resolved: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    const { result } = renderHook(() => useComments("doc-1", "reviewer@example.com"));

    act(() => {
      result.current.createReply("parent-1", "Thanks!");
    });

    expect(addCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        parentCommentId: "parent-1",
        anchorText: "Paragraph 1",
        userId: "reviewer@example.com",
      }),
    );
  });

  it("falls back to default reply anchor when parent is missing", () => {
    const { result } = renderHook(() => useComments("doc-2", "reviewer@example.com"));

    act(() => {
      result.current.createReply("missing-parent", "Reply body");
    });

    expect(addCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-2",
        parentCommentId: "missing-parent",
        anchorText: "Reply",
      }),
    );
  });
});
