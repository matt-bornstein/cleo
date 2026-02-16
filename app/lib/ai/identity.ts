const DEFAULT_AI_USER_ID = "local-dev-user";
const MAX_AI_USER_ID_LENGTH = 256;

export function normalizeAIUserId(userId?: string | null) {
  const normalized = userId?.trim();
  if (!normalized || normalized.length > MAX_AI_USER_ID_LENGTH) {
    return DEFAULT_AI_USER_ID;
  }

  return normalized;
}

