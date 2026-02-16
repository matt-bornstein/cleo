export function generateLocalId(prefix?: unknown) {
  const normalizedPrefix = typeof prefix === "string" ? prefix.trim() : "";
  const baseId =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${safeNow().toString(36)}-${buildRandomSegment()}`;

  return normalizedPrefix ? `${normalizedPrefix}-${baseId}` : baseId;
}

function buildRandomSegment() {
  const randomValue = Math.random();
  if (!Number.isFinite(randomValue) || randomValue < 0) {
    return "fallback";
  }

  const segment = randomValue.toString(36).slice(2, 10);
  return segment || "fallback";
}

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}
