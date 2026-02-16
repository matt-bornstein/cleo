import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CommentThread } from "@/components/comments/CommentThread";

const baseComment = {
  id: "comment-1",
  documentId: "doc-1",
  userId: "user-1",
  content: "Please revise this section",
  anchorFrom: 0,
  anchorTo: 0,
  anchorText: "section",
  resolved: false,
  createdAt: 1,
  updatedAt: 1,
};

describe("CommentThread", () => {
  it("submits reply content through callback", async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();

    render(
      <CommentThread
        comment={baseComment}
        replies={[]}
        onResolve={vi.fn()}
        onReply={onReply}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByPlaceholderText("Reply to comment"), "Thanks!");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onReply).toHaveBeenCalledWith("comment-1", "Thanks!");
  });

  it("renders comment and reply author labels", () => {
    render(
      <CommentThread
        comment={baseComment}
        replies={[
          {
            id: "reply-1",
            documentId: "doc-1",
            userId: "reviewer@example.com",
            content: "Agreed",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "section",
            resolved: false,
            parentCommentId: "comment-1",
            createdAt: 2,
            updatedAt: 2,
          },
        ]}
        onResolve={vi.fn()}
        onReply={vi.fn()}
      />,
    );

    expect(screen.getByText("By: user-1")).toBeInTheDocument();
    expect(screen.getByText("↳ reviewer@example.com: Agreed")).toBeInTheDocument();
  });

  it("falls back to unknown user label for blank authors", () => {
    render(
      <CommentThread
        comment={{ ...baseComment, userId: "   " }}
        replies={[
          {
            id: "reply-2",
            documentId: "doc-1",
            userId: "",
            content: "Needs clarification",
            anchorFrom: 0,
            anchorTo: 0,
            anchorText: "section",
            resolved: false,
            parentCommentId: "comment-1",
            createdAt: 2,
            updatedAt: 2,
          },
        ]}
        onResolve={vi.fn()}
        onReply={vi.fn()}
      />,
    );

    expect(screen.getByText("By: Unknown user")).toBeInTheDocument();
    expect(screen.getByText("↳ Unknown user: Needs clarification")).toBeInTheDocument();
  });

  it("does not throw when comment payload and callbacks are malformed", async () => {
    const user = userEvent.setup();

    render(
      <CommentThread
        comment={123}
        replies={[null, { id: "reply-3", content: 123 }]}
        onResolve={123}
        onReply={123}
        canComment={0}
      />,
    );

    expect(screen.getByText("Anchor: No anchor text")).toBeInTheDocument();
    expect(screen.getByText("By: Unknown user")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reply" }));
  });

  it("does not throw when resolve and reply callbacks throw", async () => {
    const user = userEvent.setup();

    render(
      <CommentThread
        comment={baseComment}
        replies={[]}
        onResolve={() => {
          throw new Error("resolve failed");
        }}
        onReply={() => {
          throw new Error("reply failed");
        }}
      />,
    );

    await expect(
      user.click(screen.getByRole("button", { name: "Resolve" })),
    ).resolves.toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByPlaceholderText("Reply to comment"), "Follow-up");
    await expect(
      user.click(screen.getByRole("button", { name: "Add" })),
    ).resolves.toBeUndefined();
  });

  it("does not throw when comment and reply field getters throw", () => {
    const commentWithThrowingGetters = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(commentWithThrowingGetters, "id", {
      get() {
        throw new Error("comment id getter failed");
      },
    });
    Object.defineProperty(commentWithThrowingGetters, "userId", {
      get() {
        throw new Error("comment userId getter failed");
      },
    });
    Object.defineProperty(commentWithThrowingGetters, "content", {
      get() {
        throw new Error("comment content getter failed");
      },
    });
    Object.defineProperty(commentWithThrowingGetters, "anchorText", {
      get() {
        throw new Error("comment anchorText getter failed");
      },
    });
    Object.defineProperty(commentWithThrowingGetters, "resolved", {
      get() {
        throw new Error("comment resolved getter failed");
      },
    });
    const replyWithThrowingGetters = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(replyWithThrowingGetters, "id", {
      get() {
        throw new Error("reply id getter failed");
      },
    });
    Object.defineProperty(replyWithThrowingGetters, "content", {
      get() {
        throw new Error("reply content getter failed");
      },
    });

    expect(() =>
      render(
        <CommentThread
          comment={commentWithThrowingGetters}
          replies={[replyWithThrowingGetters]}
          onResolve={vi.fn()}
          onReply={vi.fn()}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText("Anchor: No anchor text")).toBeInTheDocument();
    expect(screen.getByText("By: Unknown user")).toBeInTheDocument();
  });
});
