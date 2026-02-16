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
});
