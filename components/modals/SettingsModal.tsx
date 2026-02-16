"use client";

import { useState, useEffect } from "react";
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
import { AI_MODELS, DEFAULT_MODEL } from "@/lib/ai/models";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL);
  const [fontSize, setFontSize] = useState("16");

  // Load settings from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) setTheme(savedTheme);
    const savedModel = localStorage.getItem("defaultModel");
    if (savedModel) setDefaultModel(savedModel);
    const savedFontSize = localStorage.getItem("editorFontSize");
    if (savedFontSize) setFontSize(savedFontSize);
  }, []);

  const handleSave = () => {
    localStorage.setItem("theme", theme);
    localStorage.setItem("defaultModel", defaultModel);
    localStorage.setItem("editorFontSize", fontSize);

    // Apply theme
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      // System preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
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
                {AI_MODELS.map((model) => (
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

          <Button onClick={handleSave} className="w-full">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
