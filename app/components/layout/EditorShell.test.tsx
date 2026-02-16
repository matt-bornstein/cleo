import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi } from "vitest";

import { EditorShell } from "@/components/layout/EditorShell";
import { createDocument, resetDocumentsForTests } from "@/lib/documents/store";
import { triggerIdleSave } from "@/lib/diffs/store";
import { upsertPermission } from "@/lib/permissions/store";
import { saveSettings } from "@/lib/settings/store";

const pushMock = vi.fn();
let mockedSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: vi.fn(),
  }),
  useSearchParams: () => mockedSearchParams,
}));

vi.mock("@/hooks/useAILockStatus", () => ({
  useAILockStatus: () => ({
    locked: false,
  }),
}));

describe("EditorShell", () => {
  beforeEach(() => {
    pushMock.mockReset();
    resetDocumentsForTests();
    window.localStorage.clear();
    mockedSearchParams = new URLSearchParams();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });

  it("renders toolbar and split panel with document title", () => {
    const document = createDocument("Phase 1 Doc");

    render(<EditorShell documentId={document.id} />);

    expect(screen.getAllByText("Phase 1 Doc")).toHaveLength(2);
    expect(screen.getByText(/AI Assistant/)).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
  });

  it("creates a document from New modal and navigates to it", async () => {
    const user = userEvent.setup();
    const current = createDocument("Current");
    render(<EditorShell documentId={current.id} />);

    await user.click(screen.getByRole("button", { name: "New" }));
    await user.type(screen.getByPlaceholderText("Untitled document"), "New Draft");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0][0]).toMatch(/^\/editor\//);
  });

  it("opens list modal and navigates when selecting an existing document", async () => {
    const user = userEvent.setup();
    const first = createDocument("Spec A");
    const second = createDocument("Spec B");

    render(<EditorShell documentId={first.id} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: /Spec B/i }));

    expect(pushMock).toHaveBeenCalledWith(`/editor/${second.id}`);
  });

  it("opens modal from keyboard shortcut and restores from version history", async () => {
    const user = userEvent.setup();
    const document = createDocument("Versioned Doc");
    const changedSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "updated" }] }],
    });
    triggerIdleSave({
      documentId: document.id,
      snapshot: changedSnapshot,
      dedupWindowMs: 0,
    });

    render(<EditorShell documentId={document.id} />);

    await user.keyboard("{Control>}o{/Control}");
    expect(screen.getByText("Open document")).toBeInTheDocument();

    await user.keyboard("{Control>}h{/Control}");
    expect(screen.getByText("Version history")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore selected version" }));
    expect(screen.queryByText("Version history")).not.toBeInTheDocument();
  });

  it("enforces read-only role permissions for viewer", () => {
    const document = createDocument("Read Only Doc");
    saveSettings({
      userEmail: "viewer@example.com",
    });
    upsertPermission(document.id, "viewer@example.com", "viewer");

    render(<EditorShell documentId={document.id} />);

    expect(screen.getByText("Read-only mode. You have view/comment access only.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    expect(screen.getByText("AI edits are disabled for your current role.")).toBeInTheDocument();
    expect(screen.getByText("viewer")).toBeInTheDocument();
  });

  it("shows offline banner when browser is offline", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    const document = createDocument("Offline Doc");
    render(<EditorShell documentId={document.id} />);
    expect(
      screen.getByText("You are offline. Reconnect to sync collaboration and AI features."),
    ).toBeInTheDocument();
  });

  it("renames document title from toolbar action", async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Renamed Doc");
    const document = createDocument("Original Title");

    render(<EditorShell documentId={document.id} />);
    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.getAllByText("Renamed Doc").length).toBeGreaterThan(0);
    promptSpy.mockRestore();
  });

  it("grants role from share link query for non-owner user", async () => {
    mockedSearchParams = new URLSearchParams("share=commenter");
    saveSettings({
      userEmail: "invitee@example.com",
    });
    const document = createDocument("Shared Link Doc");

    render(<EditorShell documentId={document.id} />);

    await waitFor(() => {
      expect(screen.getByText("commenter")).toBeInTheDocument();
    });
  });
});
