import { getSettings, saveSettings } from "@/lib/settings/store";

describe("settings store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when unset", () => {
    const settings = getSettings();
    expect(settings.defaultModel).toBe("gpt-4o");
    expect(settings.editorFontSize).toBe(16);
  });

  it("persists and reloads settings", () => {
    saveSettings({
      theme: "dark",
      defaultModel: "gemini-2.5-pro",
      editorFontSize: 18,
      editorLineSpacing: 1.8,
    });
    const settings = getSettings();
    expect(settings.theme).toBe("dark");
    expect(settings.defaultModel).toBe("gemini-2.5-pro");
    expect(settings.editorFontSize).toBe(18);
  });
});
