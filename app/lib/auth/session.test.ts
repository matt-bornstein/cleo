import {
  hasValidLocalAuthCookie,
  LOCAL_AUTH_COOKIE_VALUE,
} from "@/lib/auth/session";

describe("local auth cookie helper", () => {
  it("accepts valid auth cookie", () => {
    expect(hasValidLocalAuthCookie(LOCAL_AUTH_COOKIE_VALUE)).toBe(true);
  });

  it("rejects missing or invalid auth cookie", () => {
    expect(hasValidLocalAuthCookie(undefined)).toBe(false);
    expect(hasValidLocalAuthCookie("0")).toBe(false);
  });
});
