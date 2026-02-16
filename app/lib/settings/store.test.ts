import { getSettings, saveSettings } from "@/lib/settings/store";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";

describe("settings store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when unset", () => {
    const settings = getSettings();
    expect(settings.defaultModel).toBe("gpt-4o");
    expect(settings.editorFontSize).toBe(16);
    expect(settings.userEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);
  });

  it("returns a fresh defaults object when unset", () => {
    const first = getSettings();
    first.defaultModel = "mutated-model";

    const second = getSettings();
    expect(second.defaultModel).toBe("gpt-4o");
  });

  it("persists and reloads settings", () => {
    saveSettings({
      theme: "dark",
      defaultModel: "gemini-2.5-pro",
      editorFontSize: 18,
      editorLineSpacing: 1.8,
      userEmail: "test@example.com",
    });
    const settings = getSettings();
    expect(settings.theme).toBe("dark");
    expect(settings.defaultModel).toBe("gemini-2.5-pro");
    expect(settings.editorFontSize).toBe(18);
    expect(settings.userEmail).toBe("test@example.com");
  });

  it("normalizes settings values before persisting", () => {
    const saved = saveSettings({
      theme: " DARK " as never,
      defaultModel: "  gpt-4.1  ",
      editorFontSize: Number.NaN,
      editorLineSpacing: 0,
      userEmail: "  TEST@EXAMPLE.COM  ",
    });

    expect(saved.theme).toBe("dark");
    expect(saved.defaultModel).toBe("gpt-4.1");
    expect(saved.editorFontSize).toBe(16);
    expect(saved.editorLineSpacing).toBe(1);
    expect(saved.userEmail).toBe("test@example.com");
  });

  it("clamps editor numeric settings within supported ranges", () => {
    const saved = saveSettings({
      theme: "dark",
      defaultModel: "gpt-4o",
      editorFontSize: 200,
      editorLineSpacing: 10,
      userEmail: "test@example.com",
    });

    expect(saved.editorFontSize).toBe(72);
    expect(saved.editorLineSpacing).toBe(3);
  });

  it("falls back to default user email for invalid email format", () => {
    const saved = saveSettings({
      theme: "dark",
      defaultModel: "gpt-4o",
      editorFontSize: 16,
      editorLineSpacing: 1.6,
      userEmail: "not-an-email",
    });

    expect(saved.userEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);
  });

  it("falls back to default model for unknown model ids", () => {
    const saved = saveSettings({
      theme: "dark",
      defaultModel: "unknown-model-id",
      editorFontSize: 16,
      editorLineSpacing: 1.6,
      userEmail: "test@example.com",
    });

    expect(saved.defaultModel).toBe("gpt-4o");

    window.localStorage.setItem(
      "plan00.settings.v1",
      JSON.stringify({
        defaultModel: "unknown-model-id",
      }),
    );
    expect(getSettings().defaultModel).toBe("gpt-4o");
  });

  it("falls back to defaults for malformed persisted settings", () => {
    window.localStorage.setItem(
      "plan00.settings.v1",
      JSON.stringify({
        theme: "invalid-theme",
        defaultModel: "model\ninvalid",
        editorFontSize: "big",
        editorLineSpacing: -1,
        userEmail: "owner-without-at",
      }),
    );

    const settings = getSettings();
    expect(settings.theme).toBe("system");
    expect(settings.defaultModel).toBe("gpt-4o");
    expect(settings.editorFontSize).toBe(16);
    expect(settings.editorLineSpacing).toBe(1);
    expect(settings.userEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);
  });
});
