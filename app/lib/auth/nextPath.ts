export function sanitizeNextPath(rawNextPath: string | null | undefined) {
  if (!rawNextPath) return "/editor";
  if (!rawNextPath.startsWith("/")) return "/editor";
  if (rawNextPath.startsWith("//")) return "/editor";
  return rawNextPath;
}
