import { hasControlChars } from "@/lib/validators/controlChars";

const MAX_NEXT_PATH_LENGTH = 2048;
const ENCODED_CONTROL_CHARS_REGEX = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

export function sanitizeNextPath(rawNextPath: unknown) {
  if (typeof rawNextPath !== "string") return "/editor";

  const normalizedNextPath = rawNextPath.trim();
  if (!normalizedNextPath) return "/editor";
  if (normalizedNextPath.length > MAX_NEXT_PATH_LENGTH) return "/editor";
  if (hasControlChars(normalizedNextPath)) return "/editor";
  if (ENCODED_CONTROL_CHARS_REGEX.test(normalizedNextPath)) return "/editor";
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
