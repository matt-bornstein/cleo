import { hasControlChars } from "@/lib/validators/controlChars";

const MAX_EMAIL_LENGTH = 320;

export function isValidEmail(value: string) {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > MAX_EMAIL_LENGTH ||
    hasControlChars(normalized)
  ) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
