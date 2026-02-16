import { getModelConfig } from "@/lib/ai/models";
import type { AppUserSettings } from "@/lib/types";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { normalizeEmailOrUndefined } from "@/lib/user/email";
import { hasControlChars } from "@/lib/validators/controlChars";
import { isValidEmail } from "@/lib/validators/email";

const STORAGE_KEY = "plan00.settings.v1";

const defaultSettings: AppUserSettings = {
  theme: "system",
  defaultModel: "gpt-4o",
  editorFontSize: 16,
  editorLineSpacing: 1.6,
  userEmail: DEFAULT_LOCAL_USER_EMAIL,
};
const VALID_THEMES = new Set(["system", "light", "dark"]);
const MIN_EDITOR_FONT_SIZE = 8;
const MAX_EDITOR_FONT_SIZE = 72;
const MIN_EDITOR_LINE_SPACING = 1;
const MAX_EDITOR_LINE_SPACING = 3;

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function normalizeSettings(settings: unknown): AppUserSettings {
  const candidate =
    settings && typeof settings === "object"
      ? (settings as Partial<AppUserSettings>)
      : undefined;
  const normalizedThemeCandidate =
    typeof candidate?.theme === "string" ? candidate.theme.trim().toLowerCase() : "";
  const normalizedTheme =
    normalizedThemeCandidate && VALID_THEMES.has(normalizedThemeCandidate)
      ? (normalizedThemeCandidate as AppUserSettings["theme"])
      : defaultSettings.theme;
  const normalizedModel =
    typeof candidate?.defaultModel === "string"
      ? candidate.defaultModel.trim()
      : undefined;
  const normalizedFontSize = clampSettingNumber(
    candidate?.editorFontSize,
    MIN_EDITOR_FONT_SIZE,
    MAX_EDITOR_FONT_SIZE,
    defaultSettings.editorFontSize ?? 16,
  );
  const normalizedLineSpacing = clampSettingNumber(
    candidate?.editorLineSpacing,
    MIN_EDITOR_LINE_SPACING,
    MAX_EDITOR_LINE_SPACING,
    defaultSettings.editorLineSpacing ?? 1.6,
  );
  const normalizedEmail = normalizeEmailOrUndefined(candidate?.userEmail);

  return {
    ...defaultSettings,
    theme: normalizedTheme,
    defaultModel:
      normalizedModel && !hasControlChars(normalizedModel)
        ? getModelConfig(normalizedModel).id
        : defaultSettings.defaultModel,
    editorFontSize: normalizedFontSize,
    editorLineSpacing: normalizedLineSpacing,
    userEmail:
      normalizedEmail && isValidEmail(normalizedEmail)
        ? normalizedEmail
        : DEFAULT_LOCAL_USER_EMAIL,
  };
}

export function getSettings(): AppUserSettings {
  if (!canUseStorage()) return { ...defaultSettings };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...defaultSettings };
  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: AppUserSettings) {
  const normalizedSettings = normalizeSettings(settings);
  if (!canUseStorage()) return normalizedSettings;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSettings));
  return normalizedSettings;
}

function clampSettingNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
