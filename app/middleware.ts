import { NextRequest, NextResponse } from "next/server";

import { shouldRedirectToSignIn } from "@/lib/auth/guards";
import { hasValidLocalAuthCookie, LOCAL_AUTH_COOKIE } from "@/lib/auth/session";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const authCookie = request.cookies.get(LOCAL_AUTH_COOKIE)?.value;
  const isAuthenticated = hasValidLocalAuthCookie(authCookie);

  if (shouldRedirectToSignIn(pathname, isAuthenticated)) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/editor/:path*"],
};
