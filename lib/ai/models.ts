export interface AIModel {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google";
  maxTokens: number;
  contextWindow: number;
  hidden?: boolean;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    maxTokens: 16384,
    contextWindow: 1047576,
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 mini",
    provider: "openai",
    maxTokens: 16384,
    contextWindow: 1047576,
    hidden: true,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    maxTokens: 128000,
    contextWindow: 200000,
    hidden: true,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    maxTokens: 64000,
    contextWindow: 200000,
    hidden: true,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    maxTokens: 64000,
    contextWindow: 200000,
    hidden: true,
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "google",
    maxTokens: 65536,
    contextWindow: 1048576,
    hidden: true,
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "google",
    maxTokens: 65536,
    contextWindow: 1048576,
    hidden: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    maxTokens: 8192,
    contextWindow: 1048576,
    hidden: true,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    maxTokens: 8192,
    contextWindow: 1048576,
    hidden: true,
  },
];

export const VISIBLE_MODELS = AI_MODELS.filter((m) => !m.hidden);

export const DEFAULT_MODEL = "gpt-5.2";

export function getModel(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}
