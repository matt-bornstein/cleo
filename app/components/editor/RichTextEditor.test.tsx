import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { RichTextEditor } from "@/components/editor/RichTextEditor";

const { triggerUpdate, useOptionalTiptapSyncMock } = vi.hoisted(() => ({
  triggerUpdate: { current: null as null | (() => void) },
  useOptionalTiptapSyncMock: vi.fn(() => ({
    extension: null,
    initialContent: null,
    isLoading: false,
  })),
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
  useOptionalTiptapSync: useOptionalTiptapSyncMock,
}));

describe("RichTextEditor", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    useOptionalTiptapSyncMock.mockClear();
  });

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
    expect(useOptionalTiptapSyncMock).not.toHaveBeenCalled();
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
    expect(useOptionalTiptapSyncMock).not.toHaveBeenCalled();
  });

  it("handles malformed non-string editor content payloads safely", async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();

    render(
      <RichTextEditor
        documentId="doc-1"
        content={123 as unknown as string}
        onContentChange={onContentChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger update" }));
    expect(onContentChange).toHaveBeenCalledWith(
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph" }],
      }),
    );
    expect(useOptionalTiptapSyncMock).not.toHaveBeenCalled();
  });

  it("passes malformed document ids to optional sync hook only in convex mode", async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";

    render(
      <RichTextEditor
        documentId={123}
        content='{"type":"doc","content":[]}'
        onContentChange={onContentChange}
      />,
    );

    expect(useOptionalTiptapSyncMock).toHaveBeenCalledWith(123);
    await user.click(screen.getByRole("button", { name: "Trigger update" }));
    expect(onContentChange).toHaveBeenCalledTimes(1);
  });

  it("does not throw when onContentChange callback is malformed non-function", async () => {
    const user = userEvent.setup();

    render(
      <RichTextEditor
        documentId="doc-1"
        content='{"type":"doc","content":[]}'
        onContentChange={123}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Trigger update" }));
    expect(useOptionalTiptapSyncMock).not.toHaveBeenCalled();
  });
});
