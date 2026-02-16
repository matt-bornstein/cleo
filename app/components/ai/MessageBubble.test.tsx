import { render, screen } from "@testing-library/react";

import { MessageBubble } from "@/components/ai/MessageBubble";

describe("MessageBubble", () => {
  it("renders changes applied badge when diffId exists", () => {
    render(
      <MessageBubble
        message={{
          id: "msg-1",
          documentId: "doc-1",
          userId: "user-1",
          role: "assistant",
          content: "Updated content.",
          model: "gpt-4o",
          diffId: "diff-1",
          createdAt: 100,
        }}
      />,
    );

    expect(screen.getByText("Changes applied")).toBeInTheDocument();
  });

  it("does not render badge without diffId", () => {
    render(
      <MessageBubble
        message={{
          id: "msg-2",
          documentId: "doc-1",
          userId: "user-1",
          role: "assistant",
          content: "No content changes.",
          createdAt: 101,
        }}
      />,
    );

    expect(screen.queryByText("Changes applied")).not.toBeInTheDocument();
  });

  it("falls back safely for malformed non-object messages", () => {
    render(<MessageBubble message={123} />);

    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("does not throw when message field getters throw", () => {
    const messageWithThrowingGetters = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(messageWithThrowingGetters, "role", {
      get() {
        throw new Error("role getter failed");
      },
    });
    Object.defineProperty(messageWithThrowingGetters, "model", {
      get() {
        throw new Error("model getter failed");
      },
    });
    Object.defineProperty(messageWithThrowingGetters, "content", {
      get() {
        throw new Error("content getter failed");
      },
    });
    Object.defineProperty(messageWithThrowingGetters, "diffId", {
      get() {
        throw new Error("diffId getter failed");
      },
    });

    expect(() =>
      render(<MessageBubble message={messageWithThrowingGetters} />),
    ).not.toThrow();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
  });
});
