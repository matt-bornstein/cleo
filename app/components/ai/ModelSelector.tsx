"use client";

import { AI_MODELS } from "@/lib/ai/models";
import { getModelConfig } from "@/lib/ai/models";

type ModelSelectorProps = {
  value: unknown;
  onValueChange: unknown;
};

export function ModelSelector({ value, onValueChange }: ModelSelectorProps) {
  const normalizedValue = getModelConfig(value).id;

  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <span>Model</span>
      <select
        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm"
        value={normalizedValue}
        onChange={(event) => {
          if (typeof onValueChange === "function") {
            onValueChange(event.target.value);
          }
        }}
      >
        {AI_MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
    </label>
  );
}
