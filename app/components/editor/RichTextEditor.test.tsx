import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { RichTextEditor } from "@/components/editor/RichTextEditor";

const { triggerUpdate } = vi.hoisted(() => ({
  triggerUpdate: { current: null as null | (() => void) },
}));

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn((config: { onUpdate?: (payload: unknown) => void }) => {
    triggerUpdate.current = () => {
      config.onUpdate?.({
        editor: {
          getJSON: () => ({
            type: "doc",
            content: [{ type: "paragraph" }],
          }),
        },
      });
    };
    return {};
  }),
  EditorContent: () => (
    <button type="button" onClick={() => triggerUpdate.current?.()}>
      Trigger update
    </button>
  ),
}));

vi.mock("@/components/editor/FormattingToolbar", () => ({
  FormattingToolbar: () => null,
}));

vi.mock("@/lib/editor/extensions", () => ({
  editorExtensions: [],
}));

vi.mock("@/hooks/useOptionalTiptapSync", () => ({
  useOptionalTiptapSync: () => ({
    extension: null,
    initialContent: null,
    isLoading: false,
  }),
}));

describe("RichTextEditor", () => {
  it("propagates editor updates and invokes onLocalUpdate callbacks", async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();
    const onLocalUpdate = vi.fn();

    render(
      <RichTextEditor
        documentId="doc-1"
        content='{"type":"doc","content":[]}'
        onContentChange={onContentChange}
        onLocalUpdate={onLocalUpdate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger update" }));

    expect(onContentChange).toHaveBeenCalledWith(
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph" }],
      }),
    );
    expect(onLocalUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not throw when onLocalUpdate is malformed non-function", async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();

    render(
      <RichTextEditor
        documentId="doc-1"
        content='{"type":"doc","content":[]}'
        onContentChange={onContentChange}
        onLocalUpdate={123 as unknown as () => void}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger update" }));
    expect(onContentChange).toHaveBeenCalledTimes(1);
  });
});
