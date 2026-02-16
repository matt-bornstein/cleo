import {
  addComment,
  listComments,
  resetCommentsForTests,
  resolveComment,
} from "@/lib/comments/store";

describe("comments store", () => {
  beforeEach(() => {
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

  it("marks comments as resolved", () => {
    const comment = addComment({
      documentId: "doc-1",
      content: "Please clarify this line",
      anchorText: "Line",
    });
    expect(comment).not.toBeNull();
    const resolved = resolveComment(comment!.id);
    expect(resolved?.resolved).toBe(true);
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

    const comments = listComments("doc-4");
    expect(comments[0]?.userId).toBe("local-dev-user");
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

    const comment = addComment({
      documentId: "doc-6",
      content: "  Keep this  ",
      anchorText: "   ",
      parentCommentId: "  parent-1  ",
    });
    expect(comment).not.toBeNull();
    expect(comment?.content).toBe("Keep this");
    expect(comment?.anchorText).toBe("Comment");
    expect(comment?.parentCommentId).toBe("parent-1");
  });
});
