const DEFAULT_AI_USER_ID = "local-dev-user";
const MAX_AI_USER_ID_LENGTH = 256;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

export function normalizeAIUserId(userId?: string | null) {
  const normalized = userId?.trim();
  if (
    !normalized ||
    normalized.length > MAX_AI_USER_ID_LENGTH ||
    CONTROL_CHARS_REGEX.test(normalized)
  ) {
    return DEFAULT_AI_USER_ID;
  }

  return normalized;
}

