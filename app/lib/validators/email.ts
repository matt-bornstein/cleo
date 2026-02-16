export function isValidEmail(value: string) {
  const normalized = value.trim();
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
