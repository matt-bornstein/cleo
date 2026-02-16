export const LOCAL_AUTH_COOKIE = "plan00_local_auth";
export const LOCAL_AUTH_COOKIE_VALUE = "1";

export function hasValidLocalAuthCookie(
  cookieValue: unknown,
  expectedValue: unknown = LOCAL_AUTH_COOKIE_VALUE,
) {
  return (
    typeof cookieValue === "string" &&
    typeof expectedValue === "string" &&
    cookieValue === expectedValue
  );
}
