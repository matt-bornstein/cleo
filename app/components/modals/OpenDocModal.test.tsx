import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { OpenDocModal } from "@/components/modals/OpenDocModal";

describe("OpenDocModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("calls delete handler for selected document", async () => {
    const user = userEvent.setup();
    const onDeleteDocument = vi.fn();

    render(
      <OpenDocModal
        open
        onOpenChange={vi.fn()}
        documents={[
          {
            id: "doc-1",
            title: "Delete Target",
            content: "{}",
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        onOpenDocument={vi.fn()}
        onDeleteDocument={onDeleteDocument}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteDocument).toHaveBeenCalledWith("doc-1");
  });

  it("does not delete when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const onDeleteDocument = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <OpenDocModal
        open
        onOpenChange={vi.fn()}
        documents={[
          {
            id: "doc-1",
            title: "Delete Target",
            content: "{}",
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        onOpenDocument={vi.fn()}
        onDeleteDocument={onDeleteDocument}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteDocument).not.toHaveBeenCalled();
  });

  it("does not delete when confirmation throws", async () => {
    const user = userEvent.setup();
    const onDeleteDocument = vi.fn();
    vi.spyOn(window, "confirm").mockImplementation(() => {
      throw new Error("confirm failed");
    });

    render(
      <OpenDocModal
        open
        onOpenChange={vi.fn()}
        documents={[
          {
            id: "doc-1",
            title: "Delete Target",
            content: "{}",
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        onOpenDocument={vi.fn()}
        onDeleteDocument={onDeleteDocument}
      />,
    );

    await expect(
      user.click(screen.getByRole("button", { name: "Delete" })),
    ).resolves.toBeUndefined();
    expect(onDeleteDocument).not.toHaveBeenCalled();
  });

  it("does not throw when callbacks are malformed non-functions", async () => {
    const user = userEvent.setup();

    render(
      <OpenDocModal
        open
        onOpenChange={123}
        documents={[
          {
            id: "doc-1",
            title: "Open Target",
            content: "{}",
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        onOpenDocument={123}
        onDeleteDocument={123}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /Open Target/i }));
  });

  it("filters malformed runtime document entries safely", () => {
    render(
      <OpenDocModal
        open
        onOpenChange={vi.fn()}
        documents={[
          null,
          {
            id: "doc-\ninvalid",
            title: "Bad",
            content: "{}",
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "doc-2",
            title: "  ",
            content: "{}",
            createdAt: 1,
            updatedAt: Number.NaN,
          },
        ]}
        onOpenDocument={vi.fn()}
        onDeleteDocument={vi.fn()}
      />,
    );

    expect(screen.getByText("Untitled")).toBeInTheDocument();
    expect(screen.queryByText("Bad")).not.toBeInTheDocument();
  });
});
