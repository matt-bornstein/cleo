import { isProtectedPath, shouldRedirectToSignIn } from "@/lib/auth/guards";

describe("auth guards", () => {
  it("flags editor routes as protected", () => {
    expect(isProtectedPath("/editor")).toBe(true);
    expect(isProtectedPath("/editor/abc")).toBe(true);
    expect(isProtectedPath("  /editor/abc  ")).toBe(true);
    expect(isProtectedPath("/editorial")).toBe(false);
    expect(isProtectedPath("/editor-archive")).toBe(false);
    expect(isProtectedPath("/sign-in")).toBe(false);
    expect(isProtectedPath(123)).toBe(false);
    expect(isProtectedPath("/editor/\nmalformed")).toBe(false);
  });

  it("redirects only when path is protected and user is unauthenticated", () => {
    expect(shouldRedirectToSignIn("/editor/abc", false)).toBe(true);
    expect(shouldRedirectToSignIn("/editor/abc", true)).toBe(false);
    expect(shouldRedirectToSignIn("/sign-in", false)).toBe(false);
    expect(shouldRedirectToSignIn(undefined, false)).toBe(false);
    expect(shouldRedirectToSignIn("/editor/abc", "true")).toBe(true);
  });
});
