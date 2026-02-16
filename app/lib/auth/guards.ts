export function isProtectedPath(pathname: unknown) {
  const normalizedPathname = normalizePathname(pathname);
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
