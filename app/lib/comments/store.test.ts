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
    addComment({
      documentId: "doc-2",
      content: "Different doc",
      anchorText: "Other",
    });

    const comments = listComments("doc-1");
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe(comment.id);
  });

  it("marks comments as resolved", () => {
    const comment = addComment({
      documentId: "doc-1",
      content: "Please clarify this line",
      anchorText: "Line",
    });
    const resolved = resolveComment(comment.id);
    expect(resolved?.resolved).toBe(true);
  });
});
