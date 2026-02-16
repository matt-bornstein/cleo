import { render, screen } from "@testing-library/react";

import { ChatMessages } from "@/components/ai/ChatMessages";

describe("ChatMessages", () => {
  it("renders empty state when messages are missing or malformed", () => {
    const { rerender } = render(<ChatMessages messages={undefined} />);
    expect(
      screen.getByText("Ask the assistant to rewrite, summarize, or edit your document."),
    ).toBeInTheDocument();

    rerender(<ChatMessages messages={123} />);
    expect(
      screen.getByText("Ask the assistant to rewrite, summarize, or edit your document."),
    ).toBeInTheDocument();
  });

  it("renders valid messages and ignores malformed entries", () => {
    render(
      <ChatMessages
        messages={[
          null,
          {
            id: "msg-1",
            role: "assistant",
            content: "Hello world",
          },
        ]}
      />,
    );

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("does not throw when message id getter throws", () => {
    const messageWithThrowingId = Object.create(null) as { id: unknown; role: string; content: string };
    Object.defineProperty(messageWithThrowingId, "id", {
      get() {
        throw new Error("id getter failed");
      },
    });
    Object.defineProperty(messageWithThrowingId, "role", {
      value: "assistant",
    });
    Object.defineProperty(messageWithThrowingId, "content", {
      value: "Getter trap message",
    });

    expect(() =>
      render(<ChatMessages messages={[messageWithThrowingId]} />),
    ).not.toThrow();
    expect(screen.getByText("Getter trap message")).toBeInTheDocument();
  });
});
