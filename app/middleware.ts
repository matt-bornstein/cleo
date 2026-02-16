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
  const nextUrl = readNextUrl(request);
  if (!nextUrl || typeof nextUrl !== "object") {
    return "/";
  }

  try {
    if (
      "pathname" in nextUrl &&
      typeof nextUrl.pathname === "string"
    ) {
      return nextUrl.pathname;
    }
  } catch {
    return "/";
  }

  return "/";
}

function normalizeSearch(request: unknown) {
  const nextUrl = readNextUrl(request);
  if (!nextUrl || typeof nextUrl !== "object") {
    return "";
  }

  try {
    if (
      "search" in nextUrl &&
      typeof nextUrl.search === "string"
    ) {
      return nextUrl.search;
    }
  } catch {
    return "";
  }

  return "";
}

function getCookieValue(request: unknown, cookieName: string) {
  if (!request || typeof request !== "object" || !("cookies" in request)) {
    return undefined;
  }

  let cookies: unknown;
  try {
    cookies = (request as { cookies?: unknown }).cookies;
  } catch {
    return undefined;
  }

  if (
    !cookies ||
    typeof cookies !== "object" ||
    !("get" in cookies) ||
    typeof cookies.get !== "function"
  ) {
    return undefined;
  }

  let value: unknown;
  try {
    value = cookies.get(cookieName);
  } catch {
    return undefined;
  }
  if (!value || typeof value !== "object" || !("value" in value)) {
    return undefined;
  }

  return typeof value.value === "string" ? value.value : undefined;
}

function createSignInUrl(request: unknown) {
  const requestedUrl = readRequestUrl(request);
  const baseUrl =
    typeof requestedUrl === "string" && requestedUrl.length > 0
      ? requestedUrl
      : "http://localhost/";

  try {
    return new URL("/sign-in", baseUrl);
  } catch {
    return new URL("/sign-in", "http://localhost/");
  }
}

function readNextUrl(request: unknown) {
  if (!request || typeof request !== "object" || !("nextUrl" in request)) {
    return undefined;
  }

  try {
    return (request as { nextUrl?: unknown }).nextUrl;
  } catch {
    return undefined;
  }
}

function readRequestUrl(request: unknown) {
  if (!request || typeof request !== "object" || !("url" in request)) {
    return undefined;
  }

  try {
    return (request as { url?: unknown }).url;
  } catch {
    return undefined;
  }
}
