import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { EditorPanel } from "@/components/editor/EditorPanel";

const { richTextEditorPropsSpy, remoteCursorsPropsSpy } = vi.hoisted(() => ({
  richTextEditorPropsSpy: vi.fn(),
  remoteCursorsPropsSpy: vi.fn(),
}));

vi.mock("@/components/editor/RichTextEditor", () => ({
  RichTextEditor: (props: {
    onContentChange: (content: string) => void;
    editable?: boolean;
  }) => {
    richTextEditorPropsSpy(props);
    return (
      <div>
        <div data-testid="rich-editor-editable">{String(props.editable)}</div>
        <button type="button" onClick={() => props.onContentChange("next-content")}>
          Emit content change
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/editor/RemoteCursors", () => ({
  RemoteCursors: (props: { others: unknown }) => {
    remoteCursorsPropsSpy(props);
    return <div data-testid="remote-cursors" />;
  },
}));

describe("EditorPanel", () => {
  beforeEach(() => {
    richTextEditorPropsSpy.mockClear();
    remoteCursorsPropsSpy.mockClear();
  });

  it("normalizes props and forwards editable false in read-only mode", async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();

    render(
      <EditorPanel
        documentId="doc-1"
        title="  Team Draft  "
        content='{"type":"doc","content":[]}'
        onContentChange={onContentChange}
        saveStateLabel="Saved"
        otherPresence={[]}
        fontSize={16}
        lineSpacing={1.5}
        readOnly
      />,
    );

    expect(screen.getByText("Team Draft")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Read-only mode. You have view/comment access only.")).toBeInTheDocument();
    expect(screen.getByTestId("rich-editor-editable")).toHaveTextContent("false");

    await user.click(screen.getByRole("button", { name: "Emit content change" }));
    expect(onContentChange).toHaveBeenCalledWith("next-content");
    expect(remoteCursorsPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        others: [],
      }),
    );
  });

  it("does not throw when callbacks and display props are malformed", async () => {
    const user = userEvent.setup();

    render(
      <EditorPanel
        documentId={123}
        title={"bad\ntitle"}
        content={123}
        onContentChange={123}
        saveStateLabel={"bad\u0000state"}
        otherPresence={123}
        fontSize={Number.NaN}
        lineSpacing={Number.NaN}
        readOnly={0}
      />,
    );

    expect(screen.getByText("Editor panel")).toBeInTheDocument();
    expect(screen.getByTestId("rich-editor-editable")).toHaveTextContent("true");
    await user.click(screen.getByRole("button", { name: "Emit content change" }));
  });
});
