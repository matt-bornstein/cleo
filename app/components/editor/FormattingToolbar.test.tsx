import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { FormattingToolbar } from "@/components/editor/FormattingToolbar";

function createEditorMock() {
  const run = vi.fn();
  const chainNode = {
    focus: vi.fn(() => chainNode),
    toggleBold: vi.fn(() => chainNode),
    toggleItalic: vi.fn(() => chainNode),
    toggleUnderline: vi.fn(() => chainNode),
    toggleStrike: vi.fn(() => chainNode),
    toggleHeading: vi.fn(() => chainNode),
    toggleBulletList: vi.fn(() => chainNode),
    toggleOrderedList: vi.fn(() => chainNode),
    toggleTaskList: vi.fn(() => chainNode),
    toggleCodeBlock: vi.fn(() => chainNode),
    toggleBlockquote: vi.fn(() => chainNode),
    setHorizontalRule: vi.fn(() => chainNode),
    insertTable: vi.fn(() => chainNode),
    run,
  };

  return {
    chain: vi.fn(() => chainNode),
    isActive: vi.fn(() => false),
    chainNode,
    run,
  };
}

describe("FormattingToolbar", () => {
  it("renders loading state when editor payload is malformed", () => {
    const { rerender } = render(<FormattingToolbar editor={null} />);
    expect(screen.getByText("Loading editor...")).toBeInTheDocument();

    rerender(<FormattingToolbar editor={{}} />);
    expect(screen.getByText("Loading editor...")).toBeInTheDocument();
  });

  it("renders loading state when editor method getters throw", () => {
    const malformedEditor = Object.create(null) as { chain: unknown; isActive: unknown };
    Object.defineProperty(malformedEditor, "chain", {
      get() {
        throw new Error("chain getter failed");
      },
    });
    Object.defineProperty(malformedEditor, "isActive", {
      get() {
        throw new Error("isActive getter failed");
      },
    });

    render(<FormattingToolbar editor={malformedEditor} />);
    expect(screen.getByText("Loading editor...")).toBeInTheDocument();
  });

  it("invokes editor chain commands from toolbar actions", async () => {
    const user = userEvent.setup();
    const editor = createEditorMock();

    render(<FormattingToolbar editor={editor} />);
    await user.click(screen.getByRole("button", { name: "B" }));

    expect(editor.chain).toHaveBeenCalled();
    expect(editor.chainNode.focus).toHaveBeenCalled();
    expect(editor.chainNode.toggleBold).toHaveBeenCalled();
    expect(editor.run).toHaveBeenCalled();
  });

  it("does not throw when editor chain actions fail at runtime", async () => {
    const user = userEvent.setup();
    const editor = createEditorMock();
    editor.chainNode.toggleBold.mockImplementation(() => {
      throw new Error("malformed editor action");
    });

    render(<FormattingToolbar editor={editor} />);
    await user.click(screen.getByRole("button", { name: "B" }));
  });

  it("does not throw when isActive checks throw during render", () => {
    const editor = createEditorMock();
    editor.isActive.mockImplementation(() => {
      throw new Error("isActive failed");
    });

    expect(() => render(<FormattingToolbar editor={editor} />)).not.toThrow();
    expect(screen.getByRole("button", { name: "B" })).toBeInTheDocument();
  });
});
