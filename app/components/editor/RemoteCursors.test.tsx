import { render, screen } from "@testing-library/react";

import { RemoteCursors } from "@/components/editor/RemoteCursors";

describe("RemoteCursors", () => {
  it("renders empty state when collaborators list is missing or malformed", () => {
    const { rerender } = render(<RemoteCursors others={undefined} />);
    expect(screen.getByText("No other collaborators online.")).toBeInTheDocument();

    rerender(<RemoteCursors others={123} />);
    expect(screen.getByText("No other collaborators online.")).toBeInTheDocument();
  });

  it("renders collaborator badges from valid presence data", () => {
    render(
      <RemoteCursors
        others={[
          {
            id: "presence-1",
            data: {
              name: "Alice",
              color: "#ff0000",
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("filters malformed entries and falls back to collaborator defaults", () => {
    render(
      <RemoteCursors
        others={[
          null,
          { id: "bad\nid", data: { name: "Ignore me" } },
          { id: "presence-2", data: { name: 123, color: 456 } },
        ]}
      />,
    );

    expect(screen.getByText("Collaborator")).toBeInTheDocument();
    expect(screen.queryByText("Ignore me")).not.toBeInTheDocument();
  });
});
