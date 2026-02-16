import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CommentInput } from "@/components/comments/CommentInput";

describe("CommentInput", () => {
  it("submits trimmed values and clears input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CommentInput onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("Write a comment");
    await user.type(textarea, "  Hello team  ");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSubmit).toHaveBeenCalledWith("Hello team");
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("ignores blank submissions", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CommentInput onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText("Write a comment"), "   ");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not throw when submit handler is malformed non-function", async () => {
    const user = userEvent.setup();

    render(<CommentInput onSubmit={123} />);

    const textarea = screen.getByPlaceholderText("Write a comment");
    await user.type(textarea, "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect((textarea as HTMLTextAreaElement).value).toBe("Keep this draft");
  });

  it("does not throw when submit handler throws", async () => {
    const user = userEvent.setup();

    render(
      <CommentInput
        onSubmit={() => {
          throw new Error("submit failed");
        }}
      />,
    );

    const textarea = screen.getByPlaceholderText("Write a comment");
    await user.type(textarea, "Keep this draft");
    await expect(
      user.click(screen.getByRole("button", { name: "Add" })),
    ).resolves.toBeUndefined();

    expect((textarea as HTMLTextAreaElement).value).toBe("Keep this draft");
  });
});
