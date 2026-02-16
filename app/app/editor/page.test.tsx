import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import EditorIndexPage from "@/app/editor/page";

const pushMock = vi.fn();
const useDocumentsMock = vi.fn();
const useSettingsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
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
});
