"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  VISIBLE_MODELS,
  DEFAULT_MODEL,
  DEFAULT_CHAT_MODEL_IDS,
  getChatModels,
} from "@/lib/ai/models";
import { Loader2 } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const settings = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);

  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL);
  const [enabledModelIds, setEnabledModelIds] = useState<string[]>([
    ...DEFAULT_CHAT_MODEL_IDS,
  ]);
  const [fontSize, setFontSize] = useState("16");
  const [saving, setSaving] = useState(false);

  // Sync local state from server settings
  useEffect(() => {
    if (settings && open) {
      const enabledModels = getChatModels(settings.enabledModelIds);
      const savedEnabledModelIds = enabledModels.map((model) => model.id);
      const savedDefaultModel = settings.defaultModel ?? DEFAULT_MODEL;

      setTheme((settings.theme as "light" | "dark" | "system") ?? "system");
      setEnabledModelIds(savedEnabledModelIds);
      setDefaultModel(
        savedEnabledModelIds.includes(savedDefaultModel)
          ? savedDefaultModel
          : savedEnabledModelIds[0] ?? DEFAULT_MODEL
      );
      setFontSize(String(settings.editorFontSize ?? 16));
    }
  }, [settings, open]);

  const enabledModels = getChatModels(enabledModelIds);

  const handleModelToggle = (modelId: string, enabled: boolean) => {
    const selectedIds = new Set(enabledModelIds);
    if (enabled) {
      selectedIds.add(modelId);
    } else {
      selectedIds.delete(modelId);
    }

    const nextModelIds = VISIBLE_MODELS
      .filter((model) => selectedIds.has(model.id))
      .map((model) => model.id);
    if (nextModelIds.length === 0) return;

    setEnabledModelIds(nextModelIds);
    if (!nextModelIds.includes(defaultModel)) {
      setDefaultModel(nextModelIds[0]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        theme,
        defaultModel,
        enabledModelIds,
        editorFontSize: parseInt(fontSize),
      });

      // Also save to localStorage for immediate theme application
      localStorage.setItem("theme", theme);
      localStorage.setItem("defaultModel", defaultModel);
      localStorage.setItem("editorFontSize", fontSize);

      // Apply theme immediately
      applyTheme(theme);

      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {settings === undefined ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Theme */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme</label>
              <Select value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Models shown in chat */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Models shown in chat</p>
                <p className="text-xs text-muted-foreground">
                  Choose which models appear in the chat model selector.
                </p>
              </div>
              <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                {VISIBLE_MODELS.map((model) => {
                  const checked = enabledModelIds.includes(model.id);
                  const isOnlyEnabledModel =
                    checked && enabledModelIds.length === 1;

                  return (
                    <label
                      key={model.id}
                      className="flex cursor-pointer items-start gap-2 rounded-sm p-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={isOnlyEnabledModel}
                        onCheckedChange={(value) =>
                          handleModelToggle(model.id, value === true)
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm leading-tight">
                          {model.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {model.provider}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                At least one model must remain enabled.
              </p>
            </div>

            <Separator />

            {/* Default AI Model */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Default AI Model</label>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Font Size */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Editor Font Size</label>
              <Select value={fontSize} onValueChange={setFontSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">Small (14px)</SelectItem>
                  <SelectItem value="16">Medium (16px)</SelectItem>
                  <SelectItem value="18">Large (18px)</SelectItem>
                  <SelectItem value="20">Extra Large (20px)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function applyTheme(theme: "light" | "dark" | "system") {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else if (theme === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
}
