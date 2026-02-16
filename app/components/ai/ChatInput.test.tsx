import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ChatInput } from "@/components/ai/ChatInput";

describe("ChatInput", () => {
  it("submits on Enter and clears input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<ChatInput onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText("Ask AI to edit this document...");

    await user.type(textarea, "hello world");
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("hello world");
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("does not submit on Shift+Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<ChatInput onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText("Ask AI to edit this document...");

    await user.type(textarea, "line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables textarea and submit button when disabled", () => {
    render(<ChatInput onSubmit={vi.fn().mockResolvedValue(undefined)} disabled />);

    expect(screen.getByPlaceholderText("Ask AI to edit this document...")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();
  });

  it("restores prompt text when submit handler rejects", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("request failed"));

    render(<ChatInput onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText("Ask AI to edit this document...");

    await user.type(textarea, "retry me");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe("retry me");
    });
  });
});
