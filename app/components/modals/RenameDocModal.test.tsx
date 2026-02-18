import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { RenameDocModal } from "@/components/modals/RenameDocModal";

describe("RenameDocModal", () => {
  it("renames document and closes modal on submit", async () => {
    const user = userEvent.setup();
    const onRenameDocument = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <RenameDocModal
        open
        onOpenChange={onOpenChange}
        documentTitle="Current Title"
        onRenameDocument={onRenameDocument}
      />,
    );

    await user.clear(screen.getByPlaceholderText("Untitled document"));
    await user.type(screen.getByPlaceholderText("Untitled document"), "Updated Title");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(onRenameDocument).toHaveBeenCalledWith("Updated Title");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not throw when callbacks are malformed non-functions", async () => {
    const user = userEvent.setup();

    render(
      <RenameDocModal
        open
        onOpenChange={123}
        documentTitle="Current Title"
        onRenameDocument={123}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });
});
