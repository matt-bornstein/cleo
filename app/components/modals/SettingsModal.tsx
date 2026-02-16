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

type SettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export function SettingsModal({ open, onOpenChange, onSaved }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppUserSettings>(getSettings());

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setSettings(getSettings());
        }
        onOpenChange(nextOpen);
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
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                saveSettings(settings);
                onSaved?.();
                onOpenChange(false);
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
