import { hasControlChars } from "@/lib/validators/controlChars";

export function isProtectedPath(pathname: unknown) {
  const normalizedPathname = normalizePathname(pathname);
  if (!normalizedPathname || hasControlChars(normalizedPathname)) {
    return false;
  }
  return (
    normalizedPathname === "/editor" ||
    normalizedPathname.startsWith("/editor/")
  );
}

export function shouldRedirectToSignIn(
  pathname: unknown,
  isAuthenticated: unknown,
) {
  return isProtectedPath(pathname) && isAuthenticated !== true;
}

function normalizePathname(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
