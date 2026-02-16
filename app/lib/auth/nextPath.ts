const MAX_NEXT_PATH_LENGTH = 2048;

export function sanitizeNextPath(rawNextPath: unknown) {
  if (typeof rawNextPath !== "string") return "/editor";

  const normalizedNextPath = rawNextPath.trim();
  if (!normalizedNextPath) return "/editor";
  if (normalizedNextPath.length > MAX_NEXT_PATH_LENGTH) return "/editor";
  if (/[\u0000-\u001F\u007F]/.test(normalizedNextPath)) return "/editor";
  if (!normalizedNextPath.startsWith("/")) return "/editor";
  if (normalizedNextPath.startsWith("//")) return "/editor";

  if (
    normalizedNextPath === "/editor" ||
    normalizedNextPath.startsWith("/editor/") ||
    normalizedNextPath.startsWith("/editor?") ||
    normalizedNextPath.startsWith("/editor#")
  ) {
    return normalizedNextPath;
  }

  return "/editor";
}
