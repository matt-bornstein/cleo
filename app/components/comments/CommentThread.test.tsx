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
});
