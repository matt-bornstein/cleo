export function generateLocalId(prefix?: string) {
  const baseId =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Math.max(0, Date.now()).toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;

  return prefix ? `${prefix}-${baseId}` : baseId;
}
