import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { hasControlChars } from "@/lib/validators/controlChars";

export function normalizeEmailOrUndefined(value: unknown) {
  const normalizedValue =
    typeof value === "string" ? value.trim().toLowerCase() : undefined;
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
  value: unknown,
  fallback: string,
) {
  return normalizeEmailOrUndefined(value) ?? fallback;
}
