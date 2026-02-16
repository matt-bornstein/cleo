import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";
import { hasControlChars } from "@/lib/validators/controlChars";

export const DEFAULT_AI_USER_ID = DEFAULT_LOCAL_USER_ID;

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

