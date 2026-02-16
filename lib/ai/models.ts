export interface AIModel {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google";
  maxTokens: number;
  contextWindow: number;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    maxTokens: 4096,
    contextWindow: 1047576,
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    maxTokens: 8192,
    contextWindow: 200000,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    maxTokens: 8192,
    contextWindow: 1048576,
  },
];

export const DEFAULT_MODEL = "gpt-4o";

export function getModel(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}
