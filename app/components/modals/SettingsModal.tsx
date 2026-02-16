"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AI_MODELS } from "@/lib/ai/models";
import { getSettings, saveSettings } from "@/lib/settings/store";
import type { AppUserSettings, ThemeSetting } from "@/lib/types";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";

type SettingsModalProps = {
  open: unknown;
  onOpenChange: unknown;
  onSaved?: unknown;
  onSignOut?: unknown;
};

export function SettingsModal({
  open,
  onOpenChange,
  onSaved,
  onSignOut,
}: SettingsModalProps) {
  const normalizedOpen = open === true;
  const [settings, setSettings] = useState<AppUserSettings>(readSettingsSafely);
  const hasSignOutHandler = typeof onSignOut === "function";

  return (
    <Dialog
      open={normalizedOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setSettings(readSettingsSafely());
        }
        safeOnOpenChange(onOpenChange, nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Theme, model, and editor display preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-600">
          <label className="space-y-1">
            <span className="text-xs">Theme</span>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2"
              value={settings.theme}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  theme: event.target.value as ThemeSetting,
                }))
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs">Default AI model</span>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2"
              value={settings.defaultModel}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, defaultModel: event.target.value }))
              }
            >
              {AI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 col-span-2">
              <span className="text-xs">User email (for permissions)</span>
              <Input
                type="email"
                value={settings.userEmail ?? ""}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    userEmail: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs">Font size</span>
              <Input
                type="number"
                value={settings.editorFontSize}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    editorFontSize: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs">Line spacing</span>
              <Input
                type="number"
                step="0.1"
                value={settings.editorLineSpacing}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    editorLineSpacing: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            {hasSignOutHandler ? (
              <Button
                variant="outline"
                onClick={() => {
                  safeOnSignOut(onSignOut);
                }}
              >
                Sign out
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                safeOnOpenChange(onOpenChange, false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                saveSettingsSafely(settings);
                safeOnSaved(onSaved);
                safeOnOpenChange(onOpenChange, false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function readSettingsSafely() {
  try {
    return getSettings();
  } catch {
    return createFallbackSettings();
  }
}

function saveSettingsSafely(settings: AppUserSettings) {
  try {
    saveSettings(settings);
  } catch {
    return;
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

function safeOnOpenChange(onOpenChange: unknown, nextOpen: boolean) {
  if (typeof onOpenChange !== "function") {
    return;
  }

  try {
    onOpenChange(nextOpen);
  } catch {
    return;
  }
}

function safeOnSaved(onSaved: unknown) {
  if (typeof onSaved !== "function") {
    return;
  }

  try {
    onSaved();
  } catch {
    return;
  }
}

function safeOnSignOut(onSignOut: unknown) {
  if (typeof onSignOut !== "function") {
    return;
  }

  try {
    void Promise.resolve(onSignOut()).catch(() => {
      return;
    });
  } catch {
    return;
  }
}
