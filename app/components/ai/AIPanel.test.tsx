import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AIPanel } from "@/components/ai/AIPanel";

const useAIChatMock = vi.fn();
vi.mock("@/hooks/useAIChat", () => ({
  useAIChat: (...args: unknown[]) => useAIChatMock(...args),
}));

const useAILockStatusMock = vi.fn();
vi.mock("@/hooks/useAILockStatus", () => ({
  useAILockStatus: (...args: unknown[]) => useAILockStatusMock(...args),
}));

describe("AIPanel", () => {
  beforeEach(() => {
    useAILockStatusMock.mockReset();
    useAIChatMock.mockReset();
    useAIChatMock.mockReturnValue({
      messages: [],
      selectedModel: "gpt-4o",
      selectedModelLabel: "OpenAI GPT-4o",
      setSelectedModel: vi.fn(),
      sendPrompt: vi.fn(),
      isLoading: false,
      error: null,
      clearChat: vi.fn(),
    });
  });

  it("shows collaborator busy indicator and disables send when locked by others", () => {
    useAILockStatusMock.mockReturnValue({
      locked: true,
      lockedBy: "alice@example.com",
    });

    render(
      <AIPanel
        documentId="doc-1"
        currentDocumentContent="{}"
        currentUserId="bob@example.com"
        onApplyContent={vi.fn()}
      />,
    );

    expect(screen.getByText("AI (alice@example.com) is working...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();
  });

  it("does not show busy indicator when lock belongs to current user", () => {
    useAILockStatusMock.mockReturnValue({
      locked: true,
      lockedBy: "bob@example.com",
    });

    render(
      <AIPanel
        documentId="doc-1"
        currentDocumentContent="{}"
        currentUserId="bob@example.com"
        onApplyContent={vi.fn()}
      />,
    );

    expect(screen.queryByText(/AI \(.*\) is working/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
  });

  it("treats whitespace-padded current user id as same lock owner", () => {
    useAILockStatusMock.mockReturnValue({
      locked: true,
      lockedBy: "bob@example.com",
    });

    render(
      <AIPanel
        documentId="doc-1"
        currentDocumentContent="{}"
        currentUserId="  bob@example.com  "
        onApplyContent={vi.fn()}
      />,
    );

    expect(screen.queryByText(/AI \(.*\) is working/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
  });

  it("treats whitespace-padded lock owner id as same current user", () => {
    useAILockStatusMock.mockReturnValue({
      locked: true,
      lockedBy: "  bob@example.com  ",
    });

    render(
      <AIPanel
        documentId="doc-1"
        currentDocumentContent="{}"
        currentUserId="bob@example.com"
        onApplyContent={vi.fn()}
      />,
    );

    expect(screen.queryByText(/AI \(.*\) is working/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
  });

  it("disables clear chat action while ai request is loading", () => {
    useAILockStatusMock.mockReturnValue({
      locked: false,
    });
    useAIChatMock.mockReturnValue({
      messages: [],
      selectedModel: "gpt-4o",
      selectedModelLabel: "OpenAI GPT-4o",
      setSelectedModel: vi.fn(),
      sendPrompt: vi.fn(),
      isLoading: true,
      error: null,
      clearChat: vi.fn(),
    });

    render(
      <AIPanel
        documentId="doc-1"
        currentDocumentContent="{}"
        currentUserId="bob@example.com"
        onApplyContent={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Clear chat" })).toBeDisabled();
  });

  it("enables clear chat action when messages exist and not loading", () => {
    useAILockStatusMock.mockReturnValue({
      locked: false,
    });
    useAIChatMock.mockReturnValue({
      messages: [
        {
          id: "m-1",
          documentId: "doc-1",
          userId: "bob@example.com",
          role: "user",
          content: "hello",
          createdAt: 1,
        },
      ],
      selectedModel: "gpt-4o",
      selectedModelLabel: "OpenAI GPT-4o",
      setSelectedModel: vi.fn(),
      sendPrompt: vi.fn(),
      isLoading: false,
      error: null,
      clearChat: vi.fn(),
    });

    render(
      <AIPanel
        documentId="doc-1"
        currentDocumentContent="{}"
        currentUserId="bob@example.com"
        onApplyContent={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Clear chat" })).not.toBeDisabled();
  });

  it("enables clear chat action when only an error is present", () => {
    useAILockStatusMock.mockReturnValue({
      locked: false,
    });
    useAIChatMock.mockReturnValue({
      messages: [],
      selectedModel: "gpt-4o",
      selectedModelLabel: "OpenAI GPT-4o",
      setSelectedModel: vi.fn(),
      sendPrompt: vi.fn(),
      isLoading: false,
      error: "Prompt is required.",
      clearChat: vi.fn(),
    });

    render(
      <AIPanel
        documentId="doc-1"
        currentDocumentContent="{}"
        currentUserId="bob@example.com"
        onApplyContent={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Clear chat" })).not.toBeDisabled();
  });

  it("normalizes malformed current user ids before useAIChat handoff", () => {
    useAILockStatusMock.mockReturnValue({
      locked: false,
    });

    render(
      <AIPanel
        documentId="doc-1"
        currentDocumentContent="{}"
        currentUserId={123}
        onApplyContent={vi.fn()}
      />,
    );

    expect(useAIChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserId: "local-dev-user",
      }),
    );
  });

  it("treats malformed non-boolean canEdit values as editable", () => {
    useAILockStatusMock.mockReturnValue({
      locked: false,
    });

    render(
      <AIPanel
        documentId="doc-1"
        currentDocumentContent="{}"
        currentUserId="bob@example.com"
        onApplyContent={vi.fn()}
        canEdit={0}
      />,
    );

    expect(
      screen.queryByText("AI edits are disabled for your current role."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
  });
});
