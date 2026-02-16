import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CommentsSidebar } from "@/components/comments/CommentsSidebar";

describe("CommentsSidebar", () => {
  const baseComment = {
    id: "comment-1",
    documentId: "doc-1",
    userId: "user-1",
    content: "Looks good",
    anchorFrom: 0,
    anchorTo: 0,
    anchorText: "section",
    resolved: false,
    createdAt: 1,
    updatedAt: 1,
  };

  it("creates comments through callback bridge", async () => {
    const user = userEvent.setup();
    const onCreateComment = vi.fn();

    render(
      <CommentsSidebar
        comments={[]}
        onCreateComment={onCreateComment}
        onReplyComment={vi.fn()}
        onResolveComment={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("Comment on this doc"), "New comment");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreateComment).toHaveBeenCalledWith("New comment");
  });

  it("filters malformed comment entries and renders empty state", () => {
    render(
      <CommentsSidebar
        comments={[null, { id: "bad\nid" }]}
        onCreateComment={vi.fn()}
        onReplyComment={vi.fn()}
        onResolveComment={vi.fn()}
      />,
    );

    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });

  it("does not throw when callbacks are malformed non-functions", async () => {
    const user = userEvent.setup();

    render(
      <CommentsSidebar
        comments={[baseComment]}
        onCreateComment={123}
        onReplyComment={123}
        onResolveComment={123}
      />,
    );

    await user.type(screen.getByPlaceholderText("Comment on this doc"), "Draft");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Resolve" }));
  });

  it("does not throw when callbacks throw", async () => {
    const user = userEvent.setup();

    render(
      <CommentsSidebar
        comments={[baseComment]}
        onCreateComment={() => {
          throw new Error("create failed");
        }}
        onReplyComment={() => {
          throw new Error("reply failed");
        }}
        onResolveComment={() => {
          throw new Error("resolve failed");
        }}
      />,
    );

    await user.type(screen.getByPlaceholderText("Comment on this doc"), "Draft");
    await expect(
      user.click(screen.getByRole("button", { name: "Add" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "Resolve" })),
    ).resolves.toBeUndefined();
    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByPlaceholderText("Reply to comment"), "Follow up");
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    await expect(
      user.click(addButtons[1]),
    ).resolves.toBeUndefined();
  });

  it("does not throw when comment payload getters throw", () => {
    const commentWithThrowingGetters = Object.create(null) as {
      id: unknown;
      parentCommentId: unknown;
    };
    Object.defineProperty(commentWithThrowingGetters, "id", {
      get() {
        throw new Error("id getter failed");
      },
    });
    Object.defineProperty(commentWithThrowingGetters, "parentCommentId", {
      get() {
        throw new Error("parentCommentId getter failed");
      },
    });

    expect(() =>
      render(
        <CommentsSidebar
          comments={[commentWithThrowingGetters]}
          onCreateComment={vi.fn()}
          onReplyComment={vi.fn()}
          onResolveComment={vi.fn()}
          canComment
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });
});
