"use client";

import { useMemo, useState } from "react";

import { getSettings } from "@/lib/settings/store";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";

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
  try {
    return getSettings();
  } catch {
    return {
      theme: "system",
      defaultModel: "gpt-4o",
      editorFontSize: 16,
      editorLineSpacing: 1.6,
      userEmail: DEFAULT_LOCAL_USER_EMAIL,
    };
  }
}
