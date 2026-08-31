export interface AIModel {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google" | "xai";
  maxTokens: number;
  contextWindow: number;
  hidden?: boolean;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    provider: "openai",
    maxTokens: 128000,
    contextWindow: 1050000,
  },
  {
    id: "gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    provider: "openai",
    maxTokens: 128000,
    contextWindow: 1050000,
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    provider: "openai",
    maxTokens: 128000,
    contextWindow: 1050000,
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    provider: "openai",
    maxTokens: 16384,
    contextWindow: 1047576,
  },
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
    id: "claude-opus-5",
    name: "Claude Opus 5",
    provider: "anthropic",
    maxTokens: 128000,
    contextWindow: 1000000,
  },
  {
    id: "claude-fable-5",
    name: "Claude Fable 5",
    provider: "anthropic",
    maxTokens: 128000,
    contextWindow: 1000000,
  },
  {
    id: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    provider: "anthropic",
    maxTokens: 128000,
    contextWindow: 1000000,
  },
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    provider: "anthropic",
    maxTokens: 128000,
    contextWindow: 200000,
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
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    provider: "xai",
    // xAI publishes no separate output cap; output shares the context window.
    maxTokens: 32768,
    contextWindow: 500000,
  },
];

export const VISIBLE_MODELS = AI_MODELS.filter((m) => !m.hidden);

export const DEFAULT_MODEL = "gpt-5.6-sol";

export const DEFAULT_CHAT_MODEL_IDS = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-4o",
] as const;

const DEFAULT_CHAT_MODEL_ID_SET = new Set<string>(DEFAULT_CHAT_MODEL_IDS);

/**
 * Resolves a saved model allowlist against the current visible catalog.
 * Missing, empty, stale, or otherwise invalid settings fall back safely.
 */
export function getChatModels(modelIds?: readonly string[]): AIModel[] {
  const requestedIds =
    modelIds && modelIds.length > 0 ? new Set(modelIds) : DEFAULT_CHAT_MODEL_ID_SET;
  const models = VISIBLE_MODELS.filter((model) => requestedIds.has(model.id));

  return models.length > 0
    ? models
    : VISIBLE_MODELS.filter((model) => DEFAULT_CHAT_MODEL_ID_SET.has(model.id));
}

export function getModel(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}
