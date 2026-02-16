import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AIPanel } from "@/components/ai/AIPanel";

vi.mock("@/hooks/useAIChat", () => ({
  useAIChat: () => ({
    messages: [],
    selectedModel: "gpt-4o",
    selectedModelLabel: "OpenAI GPT-4o",
    setSelectedModel: vi.fn(),
    sendPrompt: vi.fn(),
    isLoading: false,
    error: null,
    clearChat: vi.fn(),
  }),
}));

const useAILockStatusMock = vi.fn();
vi.mock("@/hooks/useAILockStatus", () => ({
  useAILockStatus: () => useAILockStatusMock(),
}));

describe("AIPanel", () => {
  beforeEach(() => {
    useAILockStatusMock.mockReset();
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
});
