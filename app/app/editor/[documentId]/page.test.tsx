import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import EditorDocumentPage from "@/app/editor/[documentId]/page";

const editorShellMock = vi.fn();
vi.mock("@/components/layout/EditorShell", () => ({
  EditorShell: (props: { documentId: unknown }) => {
    editorShellMock(props);
    return <div data-testid="editor-shell" />;
  },
}));

describe("EditorDocumentPage", () => {
  beforeEach(() => {
    editorShellMock.mockReset();
  });

  it("passes trimmed document id from route params", async () => {
    const view = await EditorDocumentPage({
      params: Promise.resolve({ documentId: "  doc-123  " }),
    });
    render(view);

    expect(screen.getByTestId("editor-shell")).toBeInTheDocument();
    expect(editorShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "doc-123" }),
    );
  });

  it("passes undefined document id for malformed params payloads", async () => {
    const malformedView = await EditorDocumentPage({
      params: Promise.resolve(123),
    });
    render(malformedView);
    expect(editorShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: undefined }),
    );

    editorShellMock.mockReset();
    const rejectedView = await EditorDocumentPage({
      params: Promise.reject(new Error("bad params")),
    });
    render(rejectedView);
    expect(editorShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: undefined }),
    );
  });

  it("passes undefined for blank trimmed document id params", async () => {
    const view = await EditorDocumentPage({
      params: Promise.resolve({ documentId: "   " }),
    });
    render(view);

    expect(editorShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: undefined }),
    );
  });
});
