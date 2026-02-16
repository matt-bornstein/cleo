import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import EditorIndexPage from "@/app/editor/page";

const pushMock = vi.fn();
const useDocumentsMock = vi.fn();
const useSettingsMock = vi.fn();
let mockedRouter: unknown = { push: pushMock };

vi.mock("next/navigation", () => ({
  useRouter: () => mockedRouter,
}));

vi.mock("@/hooks/useDocuments", () => ({
  useDocuments: (...args: unknown[]) => useDocumentsMock(...args),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => useSettingsMock(),
}));

describe("EditorIndexPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    useDocumentsMock.mockReset();
    useSettingsMock.mockReset();
    mockedRouter = { push: pushMock };
    useSettingsMock.mockReturnValue({
      settings: { userEmail: "owner@example.com" },
    });
  });

  it("continues to existing latest document when available", async () => {
    const user = userEvent.setup();
    useDocumentsMock.mockReturnValue({
      documents: [{ id: "doc-1" }],
      create: vi.fn(),
    });

    render(<EditorIndexPage />);
    await user.click(screen.getByRole("button", { name: "Open editor" }));

    expect(pushMock).toHaveBeenCalledWith("/editor/doc-1");
  });

  it("trims existing latest document id before navigation", async () => {
    const user = userEvent.setup();
    useDocumentsMock.mockReturnValue({
      documents: [{ id: "  doc-1  " }],
      create: vi.fn(),
    });

    render(<EditorIndexPage />);
    await user.click(screen.getByRole("button", { name: "Open editor" }));

    expect(pushMock).toHaveBeenCalledWith("/editor/doc-1");
  });

  it("creates a new document when latest list is malformed", async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockReturnValue({ id: "doc-created" });
    useDocumentsMock.mockReturnValue({
      documents: [{ id: "bad\nid" }, null],
      create,
    });

    render(<EditorIndexPage />);
    await user.click(screen.getByRole("button", { name: "Open editor" }));

    expect(create).toHaveBeenCalledWith("Untitled", "owner@example.com");
    expect(pushMock).toHaveBeenCalledWith("/editor/doc-created");
  });

  it("falls back to /editor when create returns malformed document id", async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockReturnValue({ id: "bad\nid" });
    useDocumentsMock.mockReturnValue({
      documents: [],
      create,
    });

    render(<EditorIndexPage />);
    await user.click(screen.getByRole("button", { name: "Open editor" }));

    expect(pushMock).toHaveBeenCalledWith("/editor");
  });

  it("falls back to /editor when created document id getter throws", async () => {
    const user = userEvent.setup();
    const createdDocument = Object.create(null) as { id: unknown };
    Object.defineProperty(createdDocument, "id", {
      get() {
        throw new Error("id getter failed");
      },
    });
    const create = vi.fn().mockReturnValue(createdDocument);
    useDocumentsMock.mockReturnValue({
      documents: [],
      create,
    });

    render(<EditorIndexPage />);
    await expect(
      user.click(screen.getByRole("button", { name: "Open editor" })),
    ).resolves.toBeUndefined();
    expect(pushMock).toHaveBeenCalledWith("/editor");
  });

  it("falls back to default local email when settings email is malformed", async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockReturnValue({ id: "doc-created" });
    useSettingsMock.mockReturnValue({
      settings: { userEmail: 123 },
    });
    useDocumentsMock.mockReturnValue({
      documents: [],
      create,
    });

    render(<EditorIndexPage />);
    await user.click(screen.getByRole("button", { name: "Open editor" }));

    expect(create).toHaveBeenCalledWith("Untitled", "me@local.dev");
    expect(pushMock).toHaveBeenCalledWith("/editor/doc-created");
  });

  it("does not throw when router payload is malformed", async () => {
    const user = userEvent.setup();
    mockedRouter = {};
    useDocumentsMock.mockReturnValue({
      documents: [{ id: "doc-1" }],
      create: vi.fn(),
    });

    render(<EditorIndexPage />);
    await user.click(screen.getByRole("button", { name: "Open editor" }));

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not throw when router push getter throws", async () => {
    const user = userEvent.setup();
    mockedRouter = Object.create(null);
    Object.defineProperty(mockedRouter, "push", {
      get() {
        throw new Error("push getter failed");
      },
    });
    useDocumentsMock.mockReturnValue({
      documents: [{ id: "doc-1" }],
      create: vi.fn(),
    });

    render(<EditorIndexPage />);
    await expect(
      user.click(screen.getByRole("button", { name: "Open editor" })),
    ).resolves.toBeUndefined();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not throw when router push callback throws", async () => {
    const user = userEvent.setup();
    mockedRouter = {
      push: () => {
        throw new Error("push failed");
      },
    };
    useDocumentsMock.mockReturnValue({
      documents: [{ id: "doc-1" }],
      create: vi.fn(),
    });

    render(<EditorIndexPage />);
    await expect(
      user.click(screen.getByRole("button", { name: "Open editor" })),
    ).resolves.toBeUndefined();
  });
});
