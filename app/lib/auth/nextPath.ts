export function sanitizeNextPath(rawNextPath: string | null | undefined) {
  const normalizedNextPath = rawNextPath?.trim();
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
