import { hasControlChars } from "@/lib/validators/controlChars";

export type AIProvider = "openai" | "anthropic" | "google";

export type AIModelConfig = {
  id: string;
  label: string;
  provider: AIProvider;
};

export const AI_MODELS: AIModelConfig[] = [
  { id: "gpt-4o", label: "OpenAI GPT-4o", provider: "openai" },
  { id: "gpt-4.1", label: "OpenAI GPT-4.1", provider: "openai" },
  {
    id: "claude-sonnet-4-20250514",
    label: "Anthropic Claude Sonnet 4",
    provider: "anthropic",
  },
  { id: "gemini-2.5-pro", label: "Google Gemini 2.5 Pro", provider: "google" },
];

export function isSupportedModel(modelId: unknown) {
  const normalizedModelId = normalizeModelId(modelId);
  if (!normalizedModelId) {
    return false;
  }
  return AI_MODELS.some((model) => model.id === normalizedModelId);
}

export function getModelConfig(modelId: unknown) {
  const normalizedModelId = normalizeModelId(modelId);
  if (!normalizedModelId) {
    return AI_MODELS[0];
  }
  return AI_MODELS.find((model) => model.id === normalizedModelId) ?? AI_MODELS[0];
}

function normalizeModelId(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  if (!normalizedValue || hasControlChars(normalizedValue)) {
    return undefined;
  }
  return normalizedValue;
}
