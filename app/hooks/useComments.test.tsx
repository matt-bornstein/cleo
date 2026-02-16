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

  it("omits malformed non-string current user ids when creating comments", () => {
    const { result } = renderHook(() =>
      useComments("doc-1", 123 as unknown as string),
    );

    act(() => {
      result.current.createComment("Looks good", "Intro");
    });

    expect(addCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: undefined,
      }),
    );
  });

  it("omits malformed control-character current user ids when creating comments", () => {
    const { result } = renderHook(() =>
      useComments("doc-1", "bad\nuser"),
    );

    act(() => {
      result.current.createComment("Looks good", "Intro");
    });

    expect(addCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: undefined,
      }),
    );
  });

  it("short-circuits malformed non-string comment inputs before dispatch", () => {
    const { result } = renderHook(() => useComments("doc-1", "reviewer@example.com"));

    act(() => {
      result.current.createComment(123 as unknown as string, 456 as unknown as string);
    });

    expect(addCommentMock).not.toHaveBeenCalled();
  });

  it("short-circuits malformed non-string reply inputs before dispatch", () => {
    const { result } = renderHook(() => useComments("doc-1", "reviewer@example.com"));

    act(() => {
      result.current.createReply("parent-1", 123 as unknown as string);
    });

    expect(addCommentMock).not.toHaveBeenCalled();
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

  it("trims reply parent ids before lookup and forwarding", () => {
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
      result.current.createReply("  parent-1  ", "Thanks!");
    });

    expect(addCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parentCommentId: "parent-1",
        anchorText: "Paragraph 1",
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
        parentCommentId: undefined,
        anchorText: "Reply",
      }),
    );
  });

  it("handles malformed non-string parent ids for replies", () => {
    const { result } = renderHook(() => useComments("doc-2", "reviewer@example.com"));

    act(() => {
      result.current.createReply(123 as unknown as string, "Reply body");
    });

    expect(addCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-2",
        parentCommentId: undefined,
        anchorText: "Reply",
      }),
    );
  });

  it("short-circuits comment operations for invalid document ids", () => {
    const { result } = renderHook(() => useComments("   ", "reviewer@example.com"));

    expect(result.current.comments).toEqual([]);
    expect(listCommentsMock).not.toHaveBeenCalled();

    act(() => {
      result.current.createComment("Ignored", "Anchor");
      result.current.createReply("parent-1", "Ignored reply");
      result.current.markResolved("parent-1");
    });

    expect(addCommentMock).not.toHaveBeenCalled();
    expect(resolveCommentMock).not.toHaveBeenCalled();
  });

  it("short-circuits comment operations for malformed non-string document ids", () => {
    const { result } = renderHook(() =>
      useComments(123 as unknown as string, "reviewer@example.com"),
    );

    expect(result.current.comments).toEqual([]);
    expect(listCommentsMock).not.toHaveBeenCalled();

    act(() => {
      result.current.createComment("Ignored", "Anchor");
      result.current.createReply("parent-1", "Ignored reply");
      result.current.markResolved("parent-1");
    });

    expect(addCommentMock).not.toHaveBeenCalled();
    expect(resolveCommentMock).not.toHaveBeenCalled();
  });

  it("does not dispatch resolve calls for malformed non-string comment ids", () => {
    const { result } = renderHook(() =>
      useComments("doc-1", "reviewer@example.com"),
    );

    act(() => {
      result.current.markResolved(123 as unknown as string);
    });

    expect(resolveCommentMock).not.toHaveBeenCalled();
  });

  it("refreshes when marking an unresolved comment as resolved", () => {
    listCommentsMock.mockReturnValue([
      {
        id: "comment-1",
        documentId: "doc-1",
        userId: "owner@example.com",
        content: "Needs resolution",
        anchorFrom: 0,
        anchorTo: 0,
        anchorText: "Paragraph",
        resolved: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    resolveCommentMock.mockReturnValue({
      id: "comment-1",
      documentId: "doc-1",
      userId: "owner@example.com",
      content: "Needs resolution",
      anchorFrom: 0,
      anchorTo: 0,
      anchorText: "Paragraph",
      resolved: true,
      createdAt: 1,
      updatedAt: 2,
    });

    const { result } = renderHook(() => useComments("doc-1", "reviewer@example.com"));
    expect(listCommentsMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.markResolved("comment-1");
    });

    expect(resolveCommentMock).toHaveBeenCalledWith("comment-1");
    expect(listCommentsMock).toHaveBeenCalledTimes(2);
  });

  it("skips refresh when comment was already resolved", () => {
    listCommentsMock.mockReturnValue([
      {
        id: "comment-1",
        documentId: "doc-1",
        userId: "owner@example.com",
        content: "Already resolved",
        anchorFrom: 0,
        anchorTo: 0,
        anchorText: "Paragraph",
        resolved: true,
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
    resolveCommentMock.mockReturnValue({
      id: "comment-1",
      documentId: "doc-1",
      userId: "owner@example.com",
      content: "Already resolved",
      anchorFrom: 0,
      anchorTo: 0,
      anchorText: "Paragraph",
      resolved: true,
      createdAt: 1,
      updatedAt: 2,
    });

    const { result } = renderHook(() => useComments("doc-1", "reviewer@example.com"));
    expect(listCommentsMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.markResolved("comment-1");
    });

    expect(resolveCommentMock).toHaveBeenCalledWith("comment-1");
    expect(listCommentsMock).toHaveBeenCalledTimes(1);
  });
});
