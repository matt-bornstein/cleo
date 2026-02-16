import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ModelSelector } from "@/components/ai/ModelSelector";

describe("ModelSelector", () => {
  it("renders normalized selected model value", () => {
    render(<ModelSelector value="unknown-model" onValueChange={vi.fn()} />);

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("gpt-4o");
  });

  it("invokes value change callback with selected model", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<ModelSelector value="gpt-4o" onValueChange={onValueChange} />);
    await user.selectOptions(
      screen.getByRole("combobox"),
      "claude-sonnet-4-20250514",
    );

    expect(onValueChange).toHaveBeenCalledWith("claude-sonnet-4-20250514");
  });

  it("does not throw when change callback is malformed non-function", async () => {
    const user = userEvent.setup();

    render(<ModelSelector value="gpt-4o" onValueChange={123} />);
    await user.selectOptions(screen.getByRole("combobox"), "gemini-2.5-pro");

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "gpt-4o",
    );
  });
});
