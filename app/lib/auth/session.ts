export const LOCAL_AUTH_COOKIE = "plan00_local_auth";

export function hasValidLocalAuthCookie(
  cookieValue: string | undefined,
  expectedValue = "1",
) {
  return cookieValue === expectedValue;
}
