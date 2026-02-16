import type { AppUserSettings } from "@/lib/types";

const STORAGE_KEY = "plan00.settings.v1";

const defaultSettings: AppUserSettings = {
  theme: "system",
  defaultModel: "gpt-4o",
  editorFontSize: 16,
  editorLineSpacing: 1.6,
  userEmail: "me@local.dev",
};

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getSettings(): AppUserSettings {
  if (!canUseStorage()) return defaultSettings;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...(JSON.parse(raw) as AppUserSettings) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppUserSettings) {
  if (!canUseStorage()) return settings;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}
