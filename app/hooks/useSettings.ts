"use client";

import { useMemo, useState } from "react";

import type { AppUserSettings } from "@/lib/types";
import { getSettings } from "@/lib/settings/store";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { normalizeEmailOrUndefined } from "@/lib/user/email";
import { isValidEmail } from "@/lib/validators/email";

export function useSettings() {
  const [version, setVersion] = useState(0);

  const settings = useMemo(() => {
    void version;
    return readSettingsSafely();
  }, [version]);

  return {
    settings,
    refreshSettings: () => setVersion((value) => value + 1),
  };
}

function readSettingsSafely() {
  let settings: unknown;
  try {
    settings = getSettings();
  } catch {
    return createFallbackSettings();
  }

  return normalizeHookSettings(settings);
}

function normalizeHookSettings(settings: unknown): AppUserSettings {
  if (!settings || typeof settings !== "object") {
    return createFallbackSettings();
  }

  const theme = readSettingsField(settings, "theme");
  const defaultModel = readSettingsField(settings, "defaultModel");
  const editorFontSize = readSettingsField(settings, "editorFontSize");
  const editorLineSpacing = readSettingsField(settings, "editorLineSpacing");
  const userEmail = readSettingsField(settings, "userEmail");
  const normalizedEmail = normalizeEmailOrUndefined(userEmail);

  return {
    theme:
      theme === "light" || theme === "dark" || theme === "system"
        ? theme
        : "system",
    defaultModel:
      typeof defaultModel === "string" && defaultModel.trim().length > 0
        ? defaultModel.trim()
        : "gpt-4o",
    editorFontSize:
      typeof editorFontSize === "number" &&
      Number.isFinite(editorFontSize) &&
      editorFontSize > 0
        ? editorFontSize
        : 16,
    editorLineSpacing:
      typeof editorLineSpacing === "number" &&
      Number.isFinite(editorLineSpacing) &&
      editorLineSpacing > 0
        ? editorLineSpacing
        : 1.6,
    userEmail:
      normalizedEmail && isValidEmail(normalizedEmail)
        ? normalizedEmail
        : DEFAULT_LOCAL_USER_EMAIL,
  };
}

function readSettingsField(settings: object, key: keyof AppUserSettings) {
  try {
    return (settings as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function createFallbackSettings(): AppUserSettings {
  return {
    theme: "system",
    defaultModel: "gpt-4o",
    editorFontSize: 16,
    editorLineSpacing: 1.6,
    userEmail: DEFAULT_LOCAL_USER_EMAIL,
  };
}
