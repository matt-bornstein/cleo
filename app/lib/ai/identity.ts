import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { hasControlChars } from "@/lib/validators/controlChars";

const DEFAULT_AI_USER_ID = "local-dev-user";

export function normalizeAIUserId(userId?: string | null) {
  const normalized = userId?.trim();
  if (
    !normalized ||
    normalized.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalized)
  ) {
    return DEFAULT_AI_USER_ID;
  }

  return normalized;
}

