"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VISIBLE_MODELS, type AIModel } from "@/lib/ai/models";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models?: readonly AIModel[];
}

export function ModelSelector({
  value,
  onChange,
  models = VISIBLE_MODELS,
}: ModelSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id} className="text-xs">
            {model.name}
            <span className="ml-2 text-muted-foreground">
              ({model.provider})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
