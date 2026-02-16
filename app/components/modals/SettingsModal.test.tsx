import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { SettingsModal } from "@/components/modals/SettingsModal";
import { getSettings } from "@/lib/settings/store";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";

describe("SettingsModal", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves settings and triggers onSaved callback", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(
      <SettingsModal open onOpenChange={vi.fn()} onSaved={onSaved} />,
    );

    const emailInput = screen.getByDisplayValue(DEFAULT_LOCAL_USER_EMAIL);
    await user.clear(emailInput);
    await user.type(emailInput, "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(getSettings().userEmail).toBe("owner@example.com");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("invokes onSignOut when sign out button is clicked", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    render(
      <SettingsModal open onOpenChange={vi.fn()} onSignOut={onSignOut} />,
    );

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
