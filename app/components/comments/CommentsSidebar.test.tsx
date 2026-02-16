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
});
