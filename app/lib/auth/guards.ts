export function isProtectedPath(pathname: string) {
  return pathname === "/editor" || pathname.startsWith("/editor/");
}

export function shouldRedirectToSignIn(pathname: string, isAuthenticated: boolean) {
  return isProtectedPath(pathname) && !isAuthenticated;
}
