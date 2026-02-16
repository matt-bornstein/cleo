const DEFAULT_AI_USER_ID = "local-dev-user";

export function normalizeAIUserId(userId?: string | null) {
  const normalized = userId?.trim();
  return normalized ? normalized : DEFAULT_AI_USER_ID;
}

