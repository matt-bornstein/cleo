import { hasControlChars } from "@/lib/validators/controlChars";

export type AIProvider = "openai" | "anthropic" | "google";

export type AIModelConfig = {
  id: string;
  label: string;
  provider: AIProvider;
};

const DEFAULT_MODEL_CONFIG: AIModelConfig = {
  id: "gpt-4o",
  label: "OpenAI GPT-4o",
  provider: "openai",
};

export const AI_MODELS: AIModelConfig[] = [
  DEFAULT_MODEL_CONFIG,
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
  return safeFindModelById(normalizedModelId) !== undefined;
}

export function getModelConfig(modelId: unknown) {
  const normalizedModelId = normalizeModelId(modelId);
  if (!normalizedModelId) {
    return DEFAULT_MODEL_CONFIG;
  }
  return safeFindModelById(normalizedModelId) ?? DEFAULT_MODEL_CONFIG;
}

function normalizeModelId(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  if (!normalizedValue || hasControlChars(normalizedValue)) {
    return undefined;
  }
  return normalizedValue;
}

function safeFindModelById(modelId: string) {
  for (const model of AI_MODELS) {
    const normalizedCandidate = normalizeModelCandidate(model);
    if (!normalizedCandidate) {
      continue;
    }

    if (normalizedCandidate.id === modelId) {
      return normalizedCandidate;
    }
  }

  return undefined;
}

function normalizeModelCandidate(candidate: unknown) {
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }

  try {
    const model = candidate as Partial<AIModelConfig>;
    if (
      typeof model.id !== "string" ||
      model.id.trim().length === 0 ||
      hasControlChars(model.id.trim()) ||
      typeof model.label !== "string" ||
      model.label.trim().length === 0 ||
      hasControlChars(model.label.trim()) ||
      (model.provider !== "openai" &&
        model.provider !== "anthropic" &&
        model.provider !== "google")
    ) {
      return undefined;
    }

    return {
      id: model.id.trim(),
      label: model.label.trim(),
      provider: model.provider,
    };
  } catch {
    return undefined;
  }
}
