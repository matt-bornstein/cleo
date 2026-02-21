import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/nextPath";

const isEditorRoute = createRouteMatcher(["/editor(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const requestLabel = buildRequestLabel(request);
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  const authCookieNames = cookieNames.filter((name) => /auth|token|convex|session/i.test(name));
  debugLog(requestLabel, "incoming request", {
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isEditorRoute: isEditorRoute(request),
    cookieCount: cookieNames.length,
    authCookieNames,
  });

  const isAuthenticated = await convexAuth.isAuthenticated();
  debugLog(requestLabel, "convexAuth.isAuthenticated resolved", {
    isAuthenticated,
  });

  if (isEditorRoute(request) && !isAuthenticated) {
    const nextPath = sanitizeNextPath(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", nextPath);
    debugLog(requestLabel, "redirecting to sign-in", {
      nextPath,
      redirectUrl: redirectUrl.toString(),
    });
    return NextResponse.redirect(redirectUrl);
  }

  debugLog(requestLabel, "allowing request to continue");
  return null;
});

export const config = {
  matcher: ["/editor/:path*", "/sign-in", "/api/auth/:path*"],
};

function buildRequestLabel(request: { nextUrl: { pathname: string } }) {
  const now = new Date().toISOString();
  return `[auth-middleware ${now} ${request.nextUrl.pathname}]`;
}

function debugLog(label: string, message: string, data?: unknown) {
  if (data === undefined) {
    console.info(label, message);
    return;
  }
  console.info(label, message, safeSerialize(data));
}

function safeSerialize(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}
