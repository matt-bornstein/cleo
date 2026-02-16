export const LOCAL_AUTH_COOKIE = "plan00_local_auth";
export const LOCAL_AUTH_COOKIE_VALUE = "1";

export function hasValidLocalAuthCookie(
  cookieValue: string | undefined,
  expectedValue = LOCAL_AUTH_COOKIE_VALUE,
) {
  return cookieValue === expectedValue;
}
