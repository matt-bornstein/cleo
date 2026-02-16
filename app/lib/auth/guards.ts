export function isProtectedPath(pathname: string) {
  return pathname.startsWith("/editor");
}

export function shouldRedirectToSignIn(pathname: string, isAuthenticated: boolean) {
  return isProtectedPath(pathname) && !isAuthenticated;
}
