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
import { Separator } from "@/components/ui/separator";
import { VISIBLE_MODELS, DEFAULT_MODEL } from "@/lib/ai/models";
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
  const [fontSize, setFontSize] = useState("16");
  const [saving, setSaving] = useState(false);

  // Sync local state from server settings
  useEffect(() => {
    if (settings) {
      setTheme((settings.theme as "light" | "dark" | "system") ?? "system");
      setDefaultModel(settings.defaultModel ?? DEFAULT_MODEL);
      setFontSize(String(settings.editorFontSize ?? 16));
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        theme,
        defaultModel,
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
      <DialogContent className="sm:max-w-[425px]">
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

            {/* Default AI Model */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Default AI Model</label>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBLE_MODELS.map((model) => (
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
