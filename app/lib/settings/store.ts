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

function getStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function normalizeSettings(settings: unknown): AppUserSettings {
  const candidate =
    settings && typeof settings === "object"
      ? (settings as Partial<AppUserSettings>)
      : undefined;
  const rawTheme = readSettingsField(candidate, "theme");
  const rawDefaultModel = readSettingsField(candidate, "defaultModel");
  const rawEditorFontSize = readSettingsField(candidate, "editorFontSize");
  const rawEditorLineSpacing = readSettingsField(candidate, "editorLineSpacing");
  const rawUserEmail = readSettingsField(candidate, "userEmail");
  const normalizedThemeCandidate =
    typeof rawTheme === "string" ? rawTheme.trim().toLowerCase() : "";
  const normalizedTheme =
    normalizedThemeCandidate && VALID_THEMES.has(normalizedThemeCandidate)
      ? (normalizedThemeCandidate as AppUserSettings["theme"])
      : defaultSettings.theme;
  const normalizedModel =
    typeof rawDefaultModel === "string"
      ? rawDefaultModel.trim()
      : undefined;
  const normalizedFontSize = clampSettingNumber(
    typeof rawEditorFontSize === "number" ? rawEditorFontSize : undefined,
    MIN_EDITOR_FONT_SIZE,
    MAX_EDITOR_FONT_SIZE,
    defaultSettings.editorFontSize ?? 16,
  );
  const normalizedLineSpacing = clampSettingNumber(
    typeof rawEditorLineSpacing === "number" ? rawEditorLineSpacing : undefined,
    MIN_EDITOR_LINE_SPACING,
    MAX_EDITOR_LINE_SPACING,
    defaultSettings.editorLineSpacing ?? 1.6,
  );
  const normalizedEmail = normalizeEmailOrUndefined(rawUserEmail);

  return {
    ...defaultSettings,
    theme: normalizedTheme,
    defaultModel:
      normalizedModel && !hasControlChars(normalizedModel)
        ? normalizeDefaultModel(normalizedModel)
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
  const storage = getStorage();
  if (!storage) return { ...defaultSettings };
  const raw = safeGetItem(storage, STORAGE_KEY);
  if (!raw) return { ...defaultSettings };
  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: unknown) {
  const normalizedSettings = normalizeSettings(settings);
  const storage = getStorage();
  if (!storage) return normalizedSettings;
  safeSetItem(storage, STORAGE_KEY, JSON.stringify(normalizedSettings));
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

function safeGetItem(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    return;
  }
}

function normalizeDefaultModel(modelId: string) {
  try {
    return getModelConfig(modelId).id;
  } catch {
    return defaultSettings.defaultModel;
  }
}

function readSettingsField(
  settings: Partial<AppUserSettings> | undefined,
  key: keyof AppUserSettings,
) {
  if (!settings) {
    return undefined;
  }

  try {
    return settings[key];
  } catch {
    return undefined;
  }
}
