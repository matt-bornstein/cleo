import { render, screen } from "@testing-library/react";

import { EditorLayout } from "@/components/layout/EditorLayout";

describe("EditorLayout", () => {
  it("renders editor and ai panels when valid react nodes are provided", () => {
    render(
      <EditorLayout
        editorPanel={<div>Editor pane</div>}
        aiPanel={<div>AI pane</div>}
      />,
    );

    expect(screen.getByText("Editor pane")).toBeInTheDocument();
    expect(screen.getByText("AI pane")).toBeInTheDocument();
  });

  it("ignores malformed non-renderable panel payloads safely", () => {
    render(<EditorLayout editorPanel={{ bad: true }} aiPanel={{ bad: true }} />);

    expect(screen.getByRole("button", { name: "Open AI" })).toBeInTheDocument();
    expect(screen.queryByText("bad")).not.toBeInTheDocument();
  });
});
