import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { hasControlChars } from "@/lib/validators/controlChars";

export function normalizeEmailOrUndefined(value: string | undefined | null) {
  const normalizedValue = value?.trim().toLowerCase();
  if (
    !normalizedValue ||
    normalizedValue.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedValue)
  ) {
    return undefined;
  }

  return normalizedValue;
}

export function normalizeEmailOrFallback(
  value: string | undefined | null,
  fallback: string,
) {
  return normalizeEmailOrUndefined(value) ?? fallback;
}
