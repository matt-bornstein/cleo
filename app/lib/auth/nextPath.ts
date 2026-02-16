export function sanitizeNextPath(rawNextPath: unknown) {
  if (typeof rawNextPath !== "string") return "/editor";

  const normalizedNextPath = rawNextPath.trim();
  if (!normalizedNextPath) return "/editor";
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
