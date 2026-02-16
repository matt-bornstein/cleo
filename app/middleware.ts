import { NextRequest, NextResponse } from "next/server";

import { shouldRedirectToSignIn } from "@/lib/auth/guards";
import { sanitizeNextPath } from "@/lib/auth/nextPath";
import { hasValidLocalAuthCookie, LOCAL_AUTH_COOKIE } from "@/lib/auth/session";

export function middleware(request: NextRequest) {
  const pathname = normalizePathname(request);
  const nextPath = sanitizeNextPath(`${pathname}${normalizeSearch(request)}`);
  const authCookie = getCookieValue(request, LOCAL_AUTH_COOKIE);
  const isAuthenticated = hasValidLocalAuthCookie(authCookie);

  if (shouldRedirectToSignIn(pathname, isAuthenticated)) {
    const signInUrl = createSignInUrl(request);
    signInUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/editor/:path*"],
};

function normalizePathname(request: unknown) {
  if (
    request &&
    typeof request === "object" &&
    "nextUrl" in request &&
    request.nextUrl &&
    typeof request.nextUrl === "object" &&
    "pathname" in request.nextUrl &&
    typeof request.nextUrl.pathname === "string"
  ) {
    return request.nextUrl.pathname;
  }

  return "/";
}

function normalizeSearch(request: unknown) {
  if (
    request &&
    typeof request === "object" &&
    "nextUrl" in request &&
    request.nextUrl &&
    typeof request.nextUrl === "object" &&
    "search" in request.nextUrl &&
    typeof request.nextUrl.search === "string"
  ) {
    return request.nextUrl.search;
  }

  return "";
}

function getCookieValue(request: unknown, cookieName: string) {
  if (
    !request ||
    typeof request !== "object" ||
    !("cookies" in request) ||
    !request.cookies ||
    typeof request.cookies !== "object" ||
    !("get" in request.cookies) ||
    typeof request.cookies.get !== "function"
  ) {
    return undefined;
  }

  const value = request.cookies.get(cookieName);
  if (!value || typeof value !== "object" || !("value" in value)) {
    return undefined;
  }

  return typeof value.value === "string" ? value.value : undefined;
}

function createSignInUrl(request: unknown) {
  const baseUrl =
    request &&
    typeof request === "object" &&
    "url" in request &&
    typeof request.url === "string" &&
    request.url.length > 0
      ? request.url
      : "http://localhost/";

  try {
    return new URL("/sign-in", baseUrl);
  } catch {
    return new URL("/sign-in", "http://localhost/");
  }
}
