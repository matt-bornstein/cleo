import {
  addComment,
  listComments,
  resetCommentsForTests,
  resolveComment,
} from "@/lib/comments/store";
import { vi } from "vitest";

describe("comments store", () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "localStorage",
  );

  beforeEach(() => {
    vi.restoreAllMocks();
    if (localStorageDescriptor) {
      Object.defineProperty(window, "localStorage", localStorageDescriptor);
    }
    resetCommentsForTests();
    window.localStorage.clear();
  });

  it("creates and lists comments by document", () => {
    const comment = addComment({
      documentId: "doc-1",
      content: "Looks good",
      anchorText: "Intro paragraph",
    });
    expect(comment).not.toBeNull();
    addComment({
      documentId: "doc-2",
      content: "Different doc",
      anchorText: "Other",
    });

    const comments = listComments("doc-1");
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe(comment!.id);
    expect(comments[0].userId).toBe("local-dev-user");
  });

  it("floors created timestamps at zero when clock is negative", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(-1000);
    const comment = addComment({
      documentId: "doc-clock-floor",
      content: "Clock floor",
      anchorText: "Line",
    });

    expect(comment).not.toBeNull();
    expect(comment?.createdAt).toBe(0);
    expect(comment?.updatedAt).toBe(0);
    nowSpy.mockRestore();
  });

  it("marks comments as resolved", () => {
    const comment = addComment({
      documentId: "doc-1",
      content: "Please clarify this line",
      anchorText: "Line",
    });
    expect(comment).not.toBeNull();
    const resolved = resolveComment(`  ${comment!.id}  `);
    expect(resolved?.resolved).toBe(true);
  });

  it("does not persist when resolving an already-resolved comment", () => {
    const comment = addComment({
      documentId: "doc-resolve-noop",
      content: "Already resolved",
      anchorText: "Anchor",
    });
    expect(comment).not.toBeNull();
    resolveComment(comment!.id);

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const baselineCalls = setItemSpy.mock.calls.length;
    const resolvedAgain = resolveComment(comment!.id);

    expect(resolvedAgain?.resolved).toBe(true);
    expect(setItemSpy.mock.calls.length).toBe(baselineCalls);
  });

  it("keeps updatedAt monotonic when resolving with skewed clock values", () => {
    const comment = addComment({
      documentId: "doc-resolve-time",
      content: "Resolve me",
      anchorText: "Anchor",
    });
    expect(comment).not.toBeNull();

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue((comment?.updatedAt ?? 0) - 5000);
    const resolved = resolveComment(comment!.id);

    expect(resolved?.resolved).toBe(true);
    expect(resolved?.updatedAt).toBe(comment?.updatedAt);
    nowSpy.mockRestore();
  });

  it("stores replies with parent comment id", () => {
    const parent = addComment({
      documentId: "doc-1",
      content: "Parent",
      anchorText: "Anchor",
    });
    expect(parent).not.toBeNull();
    addComment({
      documentId: "doc-1",
      content: "Reply",
      anchorText: "Anchor",
      parentCommentId: parent!.id,
    });

    const comments = listComments("doc-1");
    const reply = comments.find((comment) => comment.parentCommentId === parent!.id);
    expect(reply?.content).toBe("Reply");
  });

  it("uses provided comment user id when valid", () => {
    addComment({
      documentId: "doc-3",
      content: "Authored by collaborator",
      anchorText: "Line",
      userId: "  collaborator@example.com  ",
    });

    const comments = listComments("doc-3");
    expect(comments[0]?.userId).toBe("collaborator@example.com");
  });

  it("falls back to local user id for invalid provided user ids", () => {
    addComment({
      documentId: "doc-4",
      content: "Bad id",
      anchorText: "Line",
      userId: "bad\nid",
    });
    addComment({
      documentId: "doc-4",
      content: "Bad length",
      anchorText: "Line",
      userId: "u".repeat(257),
    });

    const comments = listComments("doc-4");
    expect(comments).toHaveLength(2);
    expect(comments.every((comment) => comment.userId === "local-dev-user")).toBe(true);
  });

  it("rejects comment creation for invalid document ids", () => {
    const created = addComment({
      documentId: "   ",
      content: "Should fail",
      anchorText: "Line",
    });

    expect(created).toBeNull();
    expect(listComments("doc-5")).toEqual([]);
  });

  it("rejects blank comment content and normalizes anchor metadata", () => {
    const blank = addComment({
      documentId: "doc-6",
      content: "   ",
      anchorText: "Line",
    });
    expect(blank).toBeNull();

    const parent = addComment({
      documentId: "doc-6",
      content: "Parent",
      anchorText: "Line",
    });
    expect(parent).not.toBeNull();

    const comment = addComment({
      documentId: "doc-6",
      content: "  Keep this  ",
      anchorText: "bad\nanchor",
      parentCommentId: `  ${parent!.id}  `,
    });
    expect(comment).not.toBeNull();
    expect(comment?.content).toBe("Keep this");
    expect(comment?.anchorText).toBe("Comment");
    expect(comment?.parentCommentId).toBe(parent!.id);
  });

  it("rejects comment creation with disallowed control characters in content", () => {
    const comment = addComment({
      documentId: "doc-control-content",
      content: `bad${"\u0000"}content`,
      anchorText: "Anchor",
    });

    expect(comment).toBeNull();
  });

  it("rejects comment creation when content is non-string", () => {
    const comment = addComment({
      documentId: "doc-control-content",
      content: 123 as unknown as string,
      anchorText: "Anchor",
    });

    expect(comment).toBeNull();
  });

  it("rejects comment creation when params payload is malformed non-object", () => {
    const comment = addComment(123 as unknown as never);

    expect(comment).toBeNull();
  });

  it("falls back anchor text when runtime anchor input is non-string", () => {
    const comment = addComment({
      documentId: "doc-anchor-type",
      content: "Valid content",
      anchorText: 123 as unknown as string,
    });

    expect(comment).not.toBeNull();
    expect(comment?.anchorText).toBe("Comment");
  });

  it("drops malformed parent comment references", () => {
    const comment = addComment({
      documentId: "doc-6",
      content: "Reply without valid parent",
      anchorText: "Line",
      parentCommentId: "parent-\ninvalid",
    });

    expect(comment).not.toBeNull();
    expect(comment?.parentCommentId).toBeUndefined();
  });

  it("drops parent references that do not exist in the same document", () => {
    const orphan = addComment({
      documentId: "doc-7",
      content: "Orphan reply",
      anchorText: "Line",
      parentCommentId: "missing-parent",
    });

    expect(orphan).not.toBeNull();
    expect(orphan?.parentCommentId).toBeUndefined();
  });

  it("uses deterministic id tie-breaker for same-timestamp comments", () => {
    window.localStorage.setItem(
      "plan00.comments.v1",
      JSON.stringify({
        comments: [
          {
            id: "comment-b",
            documentId: "doc-tie",
            userId: "user-1",
            content: "Second",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "comment-a",
            documentId: "doc-tie",
            userId: "user-1",
            content: "First",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );

    expect(listComments("doc-tie").map((comment) => comment.id)).toEqual([
      "comment-a",
      "comment-b",
    ]);
  });

  it("filters malformed persisted comments and normalizes legacy entries", () => {
    window.localStorage.setItem(
      "plan00.comments.v1",
      JSON.stringify({
        comments: [
          {
            id: "  valid-comment  ",
            documentId: "  doc-legacy  ",
            userId: "  USER-1  ",
            content: "  Legacy content  ",
            anchorFrom: 0,
            anchorTo: 5,
            anchorText: "bad\nanchor",
            resolved: "yes",
            parentCommentId: "  parent-1  ",
            createdAt: 1,
            updatedAt: 2,
          },
          {
            id: "",
            documentId: "doc-legacy",
            userId: "user-2",
            content: "Missing id",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            createdAt: 3,
            updatedAt: 3,
          },
          {
            id: 123,
            documentId: "doc-legacy",
            userId: "user-2",
            content: "Numeric id",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            createdAt: 3,
            updatedAt: 3,
          },
          {
            id: "bad-doc",
            documentId: "doc-\ninvalid",
            userId: "user-3",
            content: "Bad doc",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            createdAt: 4,
            updatedAt: 4,
          },
          {
            id: "bad-control-content",
            documentId: "doc-legacy",
            userId: "user-3",
            content: `bad${"\u0000"}content`,
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            createdAt: 4,
            updatedAt: 4,
          },
          {
            id: "bad-time",
            documentId: "doc-legacy",
            userId: "user-3",
            content: "Bad time",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            createdAt: -1,
            updatedAt: 4,
          },
          {
            id: "valid-comment",
            documentId: "doc-legacy",
            userId: "user-2",
            content: "Latest content",
            anchorFrom: 10,
            anchorTo: 5,
            anchorText: "Anchor",
            resolved: false,
            parentCommentId: "valid-comment",
            createdAt: 5,
            updatedAt: 6,
          },
          {
            id: "valid-comment",
            documentId: "doc-legacy",
            userId: "user-3",
            content: "Stale but later in array",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: true,
            parentCommentId: "parent-2",
            createdAt: 1,
            updatedAt: 1,
          },
          null,
        ],
      }),
    );

    const comments = listComments("doc-legacy");
    expect(comments).toHaveLength(1);
    expect(comments[0]).toEqual(
      expect.objectContaining({
        id: "valid-comment",
        documentId: "doc-legacy",
        userId: "user-2",
        content: "Latest content",
        anchorText: "Anchor",
        anchorFrom: 10,
        anchorTo: 10,
        parentCommentId: undefined,
        resolved: false,
      }),
    );
  });

  it("returns empty when persisted comments container is non-array", () => {
    window.localStorage.setItem(
      "plan00.comments.v1",
      JSON.stringify({ comments: { id: "not-array" } }),
    );

    expect(listComments("doc-legacy")).toEqual([]);
  });

  it("handles malformed non-string ids in list and resolve operations safely", () => {
    const comment = addComment({
      documentId: "doc-malformed-comment-id",
      content: "Hello",
      anchorText: "Anchor",
    });
    expect(comment).not.toBeNull();

    expect(listComments(123 as unknown as string)).toEqual([]);
    expect(resolveComment(123 as unknown as string)).toBeNull();
  });

  it("normalizes malformed anchor ranges in persisted comments", () => {
    window.localStorage.setItem(
      "plan00.comments.v1",
      JSON.stringify({
        comments: [
          {
            id: "range-comment",
            documentId: "doc-ranges",
            userId: "user-1",
            content: "Range comment",
            anchorFrom: -5,
            anchorTo: -10,
            anchorText: "Anchor",
            resolved: false,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );

    expect(listComments("doc-ranges")).toEqual([
      expect.objectContaining({
        id: "range-comment",
        anchorFrom: 0,
        anchorTo: 0,
      }),
    ]);
  });

  it("normalizes persisted comment timestamps to keep updatedAt >= createdAt", () => {
    window.localStorage.setItem(
      "plan00.comments.v1",
      JSON.stringify({
        comments: [
          {
            id: "time-comment",
            documentId: "doc-times",
            userId: "user-1",
            content: "Time comment",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            createdAt: 10,
            updatedAt: 5,
          },
        ],
      }),
    );

    expect(listComments("doc-times")).toEqual([
      expect.objectContaining({
        id: "time-comment",
        createdAt: 10,
        updatedAt: 10,
      }),
    ]);
  });

  it("drops persisted parent references that do not exist in the same document", () => {
    window.localStorage.setItem(
      "plan00.comments.v1",
      JSON.stringify({
        comments: [
          {
            id: "child-comment",
            documentId: "doc-parent-validate",
            userId: "user-1",
            content: "Child",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            parentCommentId: "missing-parent",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );

    expect(listComments("doc-parent-validate")).toEqual([
      expect.objectContaining({
        id: "child-comment",
        parentCommentId: undefined,
      }),
    ]);
  });

  it("drops persisted cyclic parent references", () => {
    window.localStorage.setItem(
      "plan00.comments.v1",
      JSON.stringify({
        comments: [
          {
            id: "comment-a",
            documentId: "doc-cycles",
            userId: "user-1",
            content: "A",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            parentCommentId: "comment-b",
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "comment-b",
            documentId: "doc-cycles",
            userId: "user-1",
            content: "B",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "Anchor",
            resolved: false,
            parentCommentId: "comment-a",
            createdAt: 2,
            updatedAt: 2,
          },
        ],
      }),
    );

    expect(listComments("doc-cycles")).toEqual([
      expect.objectContaining({
        id: "comment-a",
        parentCommentId: undefined,
      }),
      expect.objectContaining({
        id: "comment-b",
        parentCommentId: undefined,
      }),
    ]);
  });

  it("falls back to in-memory comments when localStorage getter throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("localStorage getter failed");
      },
    });

    const comment = addComment({
      documentId: "doc-memory-comments",
      content: "Memory comment",
      anchorText: "Anchor",
    });

    expect(comment).not.toBeNull();
    expect(listComments("doc-memory-comments")).toEqual([
      expect.objectContaining({
        content: "Memory comment",
      }),
    ]);
  });

  it("returns empty list when localStorage getItem throws", () => {
    addComment({
      documentId: "doc-getitem-comments",
      content: "Stored comment",
      anchorText: "Anchor",
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("getItem failed");
    });

    expect(listComments("doc-getitem-comments")).toEqual([]);
  });

  it("returns normalized writes when localStorage setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("setItem failed");
    });

    const comment = addComment({
      documentId: "doc-setitem-comments",
      content: "  Stored comment  ",
      anchorText: "Anchor",
      userId: " User@Example.com ",
    });

    expect(comment).toEqual(
      expect.objectContaining({
        content: "Stored comment",
        userId: "User@Example.com",
      }),
    );
  });
});
