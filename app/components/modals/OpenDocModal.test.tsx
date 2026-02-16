import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { OpenDocModal } from "@/components/modals/OpenDocModal";

describe("OpenDocModal", () => {
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
});
