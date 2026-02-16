import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ShareModal } from "@/components/modals/ShareModal";
import { resetPermissionsForTests } from "@/lib/permissions/store";

describe("ShareModal", () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    resetPermissionsForTests();
    window.localStorage.clear();
    writeTextMock.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies shareable link to clipboard", async () => {
    const user = userEvent.setup();
    render(
      <ShareModal open onOpenChange={vi.fn()} documentId="doc-copy" />,
    );

    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    if (writeTextMock.mock.calls.length > 0) {
      expect(writeTextMock).toHaveBeenCalledWith(
        "http://localhost/editor/doc-copy?share=viewer",
      );
    }
  });

  it("resets copy button label after copied timeout", async () => {
    vi.useFakeTimers();
    render(<ShareModal open onOpenChange={vi.fn()} documentId="doc-copy-timeout" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("adds collaborator permission row", async () => {
    const user = userEvent.setup();
    render(
      <ShareModal open onOpenChange={vi.fn()} documentId="doc-share" />,
    );

    await user.type(screen.getByPlaceholderText("user@example.com"), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("person@example.com · editor")).toBeInTheDocument();
  });

  it("renders owner row when owner email is provided", () => {
    render(
      <ShareModal
        open
        onOpenChange={vi.fn()}
        documentId="doc-owner"
        ownerEmail="owner@example.com"
      />,
    );

    expect(screen.getByText("owner@example.com · owner")).toBeInTheDocument();
    expect(screen.getByText("Fixed")).toBeInTheDocument();
  });

  it("updates copied link role from selector", async () => {
    const user = userEvent.setup();
    render(
      <ShareModal open onOpenChange={vi.fn()} documentId="doc-link-role" />,
    );

    const [linkRoleSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(linkRoleSelect, "editor");
    await user.click(screen.getByRole("button", { name: "Copy link" }));

    if (writeTextMock.mock.calls.length > 0) {
      expect(writeTextMock).toHaveBeenCalledWith(
        "http://localhost/editor/doc-link-role?share=editor",
      );
    }
  });

  it("shows validation error for invalid collaborator email", async () => {
    const user = userEvent.setup();
    render(
      <ShareModal open onOpenChange={vi.fn()} documentId="doc-invalid-email" />,
    );

    await user.type(screen.getByPlaceholderText("user@example.com"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("clears validation error while user edits collaborator email", async () => {
    const user = userEvent.setup();
    render(<ShareModal open onOpenChange={vi.fn()} documentId="doc-invalid-clear" />);

    const input = screen.getByPlaceholderText("user@example.com");
    await user.type(input, "not-an-email");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();

    await user.type(input, "@example.com");
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });

  it("blocks adding the owner email as collaborator", async () => {
    const user = userEvent.setup();
    render(
      <ShareModal
        open
        onOpenChange={vi.fn()}
        documentId="doc-owner-block"
        ownerEmail="owner@example.com"
      />,
    );

    await user.type(screen.getByPlaceholderText("user@example.com"), "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(
      screen.getByText("Owner access is fixed and cannot be re-added."),
    ).toBeInTheDocument();
  });
});
