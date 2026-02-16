import { getModelConfig } from "@/lib/ai/models";
import type { AppUserSettings } from "@/lib/types";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { normalizeEmailOrFallback } from "@/lib/user/email";
import { hasControlChars } from "@/lib/validators/controlChars";

const STORAGE_KEY = "plan00.settings.v1";

const defaultSettings: AppUserSettings = {
  theme: "system",
  defaultModel: "gpt-4o",
  editorFontSize: 16,
  editorLineSpacing: 1.6,
  userEmail: DEFAULT_LOCAL_USER_EMAIL,
};
const VALID_THEMES = new Set(["system", "light", "dark"]);

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function normalizeSettings(settings: AppUserSettings | undefined): AppUserSettings {
  const normalizedTheme =
    settings?.theme && VALID_THEMES.has(settings.theme)
      ? settings.theme
      : defaultSettings.theme;
  const normalizedModel = settings?.defaultModel?.trim();
  const normalizedFontSize =
    typeof settings?.editorFontSize === "number" &&
    Number.isFinite(settings.editorFontSize) &&
    settings.editorFontSize > 0
      ? settings.editorFontSize
      : defaultSettings.editorFontSize;
  const normalizedLineSpacing =
    typeof settings?.editorLineSpacing === "number" &&
    Number.isFinite(settings.editorLineSpacing) &&
    settings.editorLineSpacing > 0
      ? settings.editorLineSpacing
      : defaultSettings.editorLineSpacing;
  const normalizedEmail = normalizeEmailOrFallback(
    settings?.userEmail,
    DEFAULT_LOCAL_USER_EMAIL,
  );

  return {
    ...defaultSettings,
    theme: normalizedTheme,
    defaultModel:
      normalizedModel && !hasControlChars(normalizedModel)
        ? getModelConfig(normalizedModel).id
        : defaultSettings.defaultModel,
    editorFontSize: normalizedFontSize,
    editorLineSpacing: normalizedLineSpacing,
    userEmail: normalizedEmail,
  };
}

export function getSettings(): AppUserSettings {
  if (!canUseStorage()) return defaultSettings;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultSettings;
  try {
    return normalizeSettings(JSON.parse(raw) as AppUserSettings);
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppUserSettings) {
  const normalizedSettings = normalizeSettings(settings);
  if (!canUseStorage()) return normalizedSettings;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSettings));
  return normalizedSettings;
}
