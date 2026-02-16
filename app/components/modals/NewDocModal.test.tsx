import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { NewDocModal } from "@/components/modals/NewDocModal";

describe("NewDocModal", () => {
  it("creates document and closes modal on submit", async () => {
    const user = userEvent.setup();
    const onCreateDocument = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <NewDocModal
        open
        onOpenChange={onOpenChange}
        onCreateDocument={onCreateDocument}
      />,
    );

    await user.type(screen.getByPlaceholderText("Untitled document"), "My new doc");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreateDocument).toHaveBeenCalledWith("My new doc");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not throw when callbacks are malformed non-functions", async () => {
    const user = userEvent.setup();

    render(<NewDocModal open onOpenChange={123} onCreateDocument={123} />);

    await user.type(screen.getByPlaceholderText("Untitled document"), "Draft");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("does not throw when callbacks throw", async () => {
    const user = userEvent.setup();

    render(
      <NewDocModal
        open
        onOpenChange={() => {
          throw new Error("onOpenChange failed");
        }}
        onCreateDocument={() => {
          throw new Error("onCreateDocument failed");
        }}
      />,
    );

    await expect(
      user.click(screen.getByRole("button", { name: "Create" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "Cancel" })),
    ).resolves.toBeUndefined();
  });
});
