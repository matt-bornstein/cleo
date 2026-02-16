"use client";

import { useMemo, useState } from "react";

import { getSettings } from "@/lib/settings/store";

export function useSettings() {
  const [version, setVersion] = useState(0);

  const settings = useMemo(() => {
    void version;
    return getSettings();
  }, [version]);

  return {
    settings,
    refreshSettings: () => setVersion((value) => value + 1),
  };
}
