import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi } from "vitest";

import { EditorShell } from "@/components/layout/EditorShell";
import { createDocument, resetDocumentsForTests } from "@/lib/documents/store";
import { triggerIdleSave } from "@/lib/diffs/store";
import * as diffsStore from "@/lib/diffs/store";
import { upsertPermission } from "@/lib/permissions/store";
import * as permissionsStore from "@/lib/permissions/store";
import { saveSettings } from "@/lib/settings/store";

function safeClearLocalStorage() {
  try {
    window.localStorage.clear();
  } catch {
    return;
  }
}

const pushMock = vi.fn();
const replaceMock = vi.fn();
const refreshMock = vi.fn();
let mockedSearchParams: unknown = new URLSearchParams();
let mockedRouter: unknown = {
  push: pushMock,
  replace: replaceMock,
  refresh: refreshMock,
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockedRouter,
  useSearchParams: () => mockedSearchParams,
}));

vi.mock("@/hooks/useAILockStatus", () => ({
  useAILockStatus: () => ({
    locked: false,
  }),
}));

describe("EditorShell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    replaceMock.mockReset();
    refreshMock.mockReset();
    resetDocumentsForTests();
    safeClearLocalStorage();
    mockedSearchParams = new URLSearchParams();
    mockedRouter = {
      push: pushMock,
      replace: replaceMock,
      refresh: refreshMock,
    };
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
    expect(replaceMock).toHaveBeenCalledWith(`/editor/${document.id}`);
  });

  it("shows access required screen for user without access", () => {
    saveSettings({
      userEmail: "outsider@example.com",
    });
    const document = createDocument("Private Doc");

    render(<EditorShell documentId={document.id} />);

    expect(screen.getByText("Access required")).toBeInTheDocument();
    expect(
      screen.getByText("You do not have permission to open this document."),
    ).toBeInTheDocument();
  });

  it("handles malformed non-string document ids safely", () => {
    render(<EditorShell documentId={123} />);

    expect(screen.getByText("Access required")).toBeInTheDocument();
  });

  it("does not throw when router and search params payloads are malformed", () => {
    const document = createDocument("Malformed runtime payloads");
    mockedRouter = {};
    mockedSearchParams = {
      get: () => {
        throw new Error("get failed");
      },
      toString: () => {
        throw new Error("toString failed");
      },
    };

    expect(() => render(<EditorShell documentId={document.id} />)).not.toThrow();
    expect(screen.getAllByText("Malformed runtime payloads").length).toBeGreaterThan(0);
  });

  it("does not throw when search params get getter throws", () => {
    const document = createDocument("Search param getter trap");
    const malformedSearchParams = Object.create(null) as { get: unknown };
    Object.defineProperty(malformedSearchParams, "get", {
      get() {
        throw new Error("get getter failed");
      },
    });
    mockedSearchParams = malformedSearchParams;

    expect(() => render(<EditorShell documentId={document.id} />)).not.toThrow();
    expect(screen.getAllByText("Search param getter trap").length).toBeGreaterThan(0);
  });

  it("does not throw when permission lookups throw", () => {
    const document = createDocument("Permission lookup failures");
    vi.spyOn(permissionsStore, "getRoleForUser").mockImplementation(() => {
      throw new Error("role lookup failed");
    });
    vi.spyOn(permissionsStore, "hasDocumentAccess").mockImplementation(() => {
      throw new Error("access lookup failed");
    });

    expect(() => render(<EditorShell documentId={document.id} />)).not.toThrow();
    expect(screen.getByText("Access required")).toBeInTheDocument();
  });

  it("does not throw when share-link permission upsert throws", () => {
    mockedSearchParams = new URLSearchParams("share=commenter");
    saveSettings({
      userEmail: "invitee@example.com",
    });
    const document = createDocument("Share upsert failures");
    vi.spyOn(permissionsStore, "upsertPermission").mockImplementation(() => {
      throw new Error("upsert failed");
    });

    expect(() => render(<EditorShell documentId={document.id} />)).not.toThrow();
    expect(screen.getByText("Applying shared access permissions...")).toBeInTheDocument();
  });

  it("does not throw when router push getter throws from access-required action", async () => {
    const user = userEvent.setup();
    saveSettings({
      userEmail: "outsider@example.com",
    });
    const document = createDocument("Push getter trap");
    const malformedRouter = Object.create(null) as { push: unknown };
    Object.defineProperty(malformedRouter, "push", {
      get() {
        throw new Error("push getter failed");
      },
    });
    mockedRouter = malformedRouter;

    render(<EditorShell documentId={document.id} />);
    await expect(
      user.click(screen.getByRole("button", { name: "Return to document list" })),
    ).resolves.toBeUndefined();
  });

  it("does not throw when router replace getter throws during share cleanup", () => {
    mockedSearchParams = new URLSearchParams("share=commenter");
    const document = createDocument("Replace getter trap");
    const malformedRouter = Object.create(null) as { replace: unknown };
    Object.defineProperty(malformedRouter, "replace", {
      get() {
        throw new Error("replace getter failed");
      },
    });
    mockedRouter = malformedRouter;

    expect(() => render(<EditorShell documentId={document.id} />)).not.toThrow();
    expect(screen.getAllByText("Replace getter trap").length).toBeGreaterThan(0);
  });

  it("does not throw when router refresh getter throws during sign out", async () => {
    const user = userEvent.setup();
    const document = createDocument("Refresh getter trap");
    const malformedRouter = Object.create(null) as {
      push: (path: string) => void;
      refresh: unknown;
    };
    Object.defineProperty(malformedRouter, "push", {
      value: pushMock,
    });
    Object.defineProperty(malformedRouter, "refresh", {
      get() {
        throw new Error("refresh getter failed");
      },
    });
    mockedRouter = malformedRouter;

    render(<EditorShell documentId={document.id} />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await expect(
      user.click(screen.getByRole("button", { name: "Sign out" })),
    ).resolves.toBeUndefined();
    expect(pushMock).toHaveBeenCalledWith("/sign-in");
  });

  it("does not throw when diff creation throws for new documents", async () => {
    const user = userEvent.setup();
    const current = createDocument("Current");
    vi.spyOn(diffsStore, "ensureCreatedDiff").mockImplementation(() => {
      throw new Error("ensureCreatedDiff failed");
    });

    render(<EditorShell documentId={current.id} />);

    await user.click(screen.getByRole("button", { name: "New" }));
    await user.type(screen.getByPlaceholderText("Untitled document"), "New Draft");
    await expect(
      user.click(screen.getByRole("button", { name: "Create" })),
    ).resolves.toBeUndefined();
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("does not throw when restoreVersion throws", async () => {
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
    vi.spyOn(diffsStore, "restoreVersion").mockImplementation(() => {
      throw new Error("restoreVersion failed");
    });

    render(<EditorShell documentId={document.id} />);
    await user.keyboard("{Control>}h{/Control}");

    await expect(
      user.click(screen.getByRole("button", { name: "Restore selected version" })),
    ).resolves.toBeUndefined();
  });

});
