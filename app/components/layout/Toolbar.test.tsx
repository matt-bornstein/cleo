import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { Toolbar } from "@/components/layout/Toolbar";

describe("Toolbar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes toolbar action callbacks", async () => {
    const user = userEvent.setup();
    const onRenameDocument = vi.fn();
    const onNewDocument = vi.fn();
    const onOpenDocument = vi.fn();
    const onToggleComments = vi.fn();
    const onHistory = vi.fn();
    const onExport = vi.fn();
    const onRawHtml = vi.fn();
    const onShare = vi.fn();
    const onSettings = vi.fn();
    render(
      <Toolbar
        documentTitle="Roadmap"
        roleLabel="editor"
        onRenameDocument={onRenameDocument}
        onNewDocument={onNewDocument}
        onOpenDocument={onOpenDocument}
        onToggleComments={onToggleComments}
        onHistory={onHistory}
        onExport={onExport}
        onRawHtml={onRawHtml}
        onShare={onShare}
        onSettings={onSettings}
      />,
    );

    await user.click(screen.getByRole("button", { name: "New" }));
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.click(screen.getByRole("button", { name: "Show comments" }));
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("button", { name: "Raw HTML" }));
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(onNewDocument).toHaveBeenCalledTimes(1);
    expect(onOpenDocument).toHaveBeenCalledTimes(1);
    expect(onRenameDocument).toHaveBeenCalledTimes(1);
    expect(onToggleComments).toHaveBeenCalledTimes(1);
    expect(onHistory).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onRawHtml).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it("does not throw when callback props are malformed non-functions", async () => {
    const user = userEvent.setup();

    render(
      <Toolbar
        documentTitle="Roadmap"
        onRenameDocument={123}
        onNewDocument={123}
        onOpenDocument={123}
        onToggleComments={123}
        onHistory={123}
        onExport={123}
        onRawHtml={123}
        onShare={123}
        onSettings={123}
        canShare={0}
      />,
    );

    const shareButton = screen.getByRole("button", { name: "Share" });
    expect(shareButton).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "New" }));
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("button", { name: "Raw HTML" }));
    await user.click(shareButton);
    await user.click(screen.getByRole("button", { name: "Settings" }));
  });

  it("falls back to untitled title and hides malformed role label", () => {
    render(
      <Toolbar
        documentTitle={123}
        roleLabel={"editor\nbad"}
        onRenameDocument={vi.fn()}
        onNewDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onToggleComments={vi.fn()}
        onHistory={vi.fn()}
        onExport={vi.fn()}
        onRawHtml={vi.fn()}
        onShare={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    expect(screen.getByText("Untitled")).toBeInTheDocument();
    expect(screen.queryByText("editor\nbad")).not.toBeInTheDocument();
  });

  it("does not throw when action callbacks throw", async () => {
    const user = userEvent.setup();
    const throwing = () => {
      throw new Error("callback failed");
    };

    render(
      <Toolbar
        documentTitle="Roadmap"
        onRenameDocument={throwing}
        onNewDocument={throwing}
        onOpenDocument={throwing}
        onToggleComments={throwing}
        onHistory={throwing}
        onExport={throwing}
        onRawHtml={throwing}
        onShare={throwing}
        onSettings={throwing}
      />,
    );

    await expect(
      user.click(screen.getByRole("button", { name: "New" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "Open" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "Rename" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "Show comments" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "History" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "Export" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "Raw HTML" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "Share" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "Settings" })),
    ).resolves.toBeUndefined();
  });
});
