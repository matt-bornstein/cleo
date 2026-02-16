import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi } from "vitest";

import { EditorShell } from "@/components/layout/EditorShell";
import { createDocument, resetDocumentsForTests } from "@/lib/documents/store";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("EditorShell", () => {
  beforeEach(() => {
    pushMock.mockReset();
    resetDocumentsForTests();
    window.localStorage.clear();
  });

  it("renders toolbar and split panel with document title", () => {
    const document = createDocument("Phase 1 Doc");

    render(<EditorShell documentId={document.id} />);

    expect(screen.getAllByText("Phase 1 Doc")).toHaveLength(2);
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(
      screen.getByText("Rich text editor area (Phase 2 will integrate Tiptap)."),
    ).toBeInTheDocument();
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
});
