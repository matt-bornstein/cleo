export function generateLocalId(prefix?: unknown) {
  const normalizedPrefix = typeof prefix === "string" ? prefix.trim() : "";
  const randomUUID = safeGenerateRandomUUID();
  const baseId =
    typeof randomUUID === "string" && randomUUID.trim().length > 0
      ? randomUUID.trim()
      : `${safeNow().toString(36)}-${buildRandomSegment()}`;

  return normalizedPrefix ? `${normalizedPrefix}-${baseId}` : baseId;
}

function buildRandomSegment() {
  let randomValue: number;
  try {
    randomValue = Math.random();
  } catch {
    return "fallback";
  }
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

function safeGenerateRandomUUID() {
  if (typeof globalThis === "undefined" || !("crypto" in globalThis)) {
    return undefined;
  }

  let cryptoValue: unknown;
  try {
    cryptoValue = globalThis.crypto;
  } catch {
    return undefined;
  }
  if (!cryptoValue || typeof cryptoValue !== "object") {
    return undefined;
  }

  let randomUUID: unknown;
  try {
    randomUUID = (cryptoValue as { randomUUID?: unknown }).randomUUID;
  } catch {
    return undefined;
  }
  if (typeof randomUUID !== "function") {
    return undefined;
  }

  try {
    return Reflect.apply(randomUUID, cryptoValue, []) as string;
  } catch {
    return undefined;
  }
}
