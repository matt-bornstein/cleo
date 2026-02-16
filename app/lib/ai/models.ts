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

export function getModelConfig(modelId: string) {
  return AI_MODELS.find((model) => model.id === modelId) ?? AI_MODELS[0];
}
