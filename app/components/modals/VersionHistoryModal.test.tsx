import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { VersionHistoryModal } from "@/components/modals/VersionHistoryModal";

const listDiffsByDocumentMock = vi.fn();
vi.mock("@/lib/diffs/store", () => ({
  listDiffsByDocument: (...args: unknown[]) => listDiffsByDocumentMock(...args),
}));

describe("VersionHistoryModal", () => {
  beforeEach(() => {
    listDiffsByDocumentMock.mockReset();
    listDiffsByDocumentMock.mockReturnValue([
      {
        id: "diff-1",
        documentId: "doc-1",
        userId: "user-1",
        patch: "@@ -0,0 +1 @@\n+hello",
        snapshotAfter: "{\"type\":\"doc\",\"content\":[]}",
        source: "manual",
        createdAt: 1,
      },
    ]);
  });

  it("restores selected snapshot and closes modal", async () => {
    const user = userEvent.setup();
    const onRestoreSnapshot = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <VersionHistoryModal
        open
        onOpenChange={onOpenChange}
        documentId="doc-1"
        onRestoreSnapshot={onRestoreSnapshot}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Restore selected version" }));

    expect(onRestoreSnapshot).toHaveBeenCalledWith("{\"type\":\"doc\",\"content\":[]}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not throw when callbacks are malformed non-functions", async () => {
    const user = userEvent.setup();

    render(
      <VersionHistoryModal
        open
        onOpenChange={123}
        documentId="doc-1"
        onRestoreSnapshot={123}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Restore selected version" }));
  });

  it("passes malformed runtime document id through safe listing path", () => {
    render(
      <VersionHistoryModal
        open
        onOpenChange={vi.fn()}
        documentId={123}
        onRestoreSnapshot={vi.fn()}
      />,
    );

    expect(listDiffsByDocumentMock).toHaveBeenCalledWith(123);
  });
});
