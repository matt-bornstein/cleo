import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/nextPath";

const isEditorRoute = createRouteMatcher(["/editor(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthenticated = await convexAuth.isAuthenticated();

  if (isEditorRoute(request) && !isAuthenticated) {
    const nextPath = sanitizeNextPath(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(redirectUrl);
  }

  return null;
});

export const config = {
  matcher: ["/editor/:path*", "/sign-in", "/api/auth/:path*"],
};
