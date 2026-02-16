import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { SettingsModal } from "@/components/modals/SettingsModal";
import { getSettings } from "@/lib/settings/store";
import * as settingsStore from "@/lib/settings/store";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";

describe("SettingsModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it("hides sign out action when onSignOut is malformed non-function", () => {
    render(
      <SettingsModal
        open
        onOpenChange={vi.fn()}
        onSignOut={123 as unknown as () => Promise<void>}
      />,
    );

    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("does not throw when onSaved callback is malformed non-function", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <SettingsModal
        open
        onOpenChange={onOpenChange}
        onSaved={123 as unknown as () => void}
      />,
    );

    const emailInput = screen.getByDisplayValue(DEFAULT_LOCAL_USER_EMAIL);
    await user.clear(emailInput);
    await user.type(emailInput, "owner@example.com");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(getSettings().userEmail).toBe("owner@example.com");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not throw when onOpenChange callback is malformed non-function", async () => {
    const user = userEvent.setup();

    render(
      <SettingsModal
        open
        onOpenChange={123 as unknown as (open: boolean) => void}
        onSaved={vi.fn()}
      />,
    );

    const emailInput = screen.getByDisplayValue(DEFAULT_LOCAL_USER_EMAIL);
    await user.clear(emailInput);
    await user.type(emailInput, "owner@example.com");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(getSettings().userEmail).toBe("owner@example.com");
  });

  it("falls back to default settings when store read throws", () => {
    vi.spyOn(settingsStore, "getSettings").mockImplementation(() => {
      throw new Error("getSettings failed");
    });

    render(
      <SettingsModal
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue(DEFAULT_LOCAL_USER_EMAIL)).toBeInTheDocument();
  });

  it("does not throw when store save throws", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    vi.spyOn(settingsStore, "saveSettings").mockImplementation(() => {
      throw new Error("saveSettings failed");
    });

    render(
      <SettingsModal open onOpenChange={onOpenChange} onSaved={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
