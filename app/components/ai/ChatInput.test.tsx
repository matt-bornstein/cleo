import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";

import { ChatInput } from "@/components/ai/ChatInput";

function createDeferred() {
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((_, rejectFn) => {
    reject = rejectFn;
  });
  return { promise, reject };
}

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

  it("ignores form submit events while disabled", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} disabled />);

    const submitButton = screen.getByRole("button", { name: "Working..." });
    const form = submitButton.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(onSubmit).not.toHaveBeenCalled();
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

  it("does not overwrite newer user input after async submit rejection", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    const onSubmit = vi.fn().mockReturnValue(deferred.promise);

    render(<ChatInput onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText("Ask AI to edit this document...");

    await user.type(textarea, "first request");
    await user.keyboard("{Enter}");
    expect((textarea as HTMLTextAreaElement).value).toBe("");

    await user.type(textarea, "new draft");
    deferred.reject(new Error("network issue"));

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe("new draft");
    });
  });

  it("does not throw when submit handler is malformed non-function", async () => {
    const user = userEvent.setup();

    render(<ChatInput onSubmit={123} />);
    const textarea = screen.getByPlaceholderText("Ask AI to edit this document...");

    await user.type(textarea, "keep draft");
    await user.keyboard("{Enter}");

    expect((textarea as HTMLTextAreaElement).value).toBe("keep draft");
  });

  it("restores textarea focus after async submit toggles disabled state", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();

    function ChatInputWithLoadingState() {
      const [isLoading, setIsLoading] = useState(false);

      return (
        <ChatInput
          disabled={isLoading}
          onSubmit={async () => {
            setIsLoading(true);
            try {
              await deferred.promise;
            } finally {
              setIsLoading(false);
            }
          }}
        />
      );
    }

    render(<ChatInputWithLoadingState />);
    const textarea = screen.getByPlaceholderText(
      "Ask AI to edit this document...",
    ) as HTMLTextAreaElement;

    textarea.focus();
    await user.type(textarea, "focus test");
    await user.keyboard("{Enter}");

    deferred.reject(new Error("done"));

    await waitFor(() => {
      expect(document.activeElement).toBe(textarea);
    });
  });
});
