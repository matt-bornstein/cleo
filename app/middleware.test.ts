import { NextRequest } from "next/server";

import {
  LOCAL_AUTH_COOKIE,
  LOCAL_AUTH_COOKIE_VALUE,
} from "@/lib/auth/session";
import { middleware } from "@/middleware";

describe("middleware auth guard", () => {
  it("handles malformed request payloads safely", () => {
    const response = middleware({} as unknown as NextRequest);
    expect(response.status).toBe(200);
  });

  it("redirects unauthenticated editor requests to sign-in", () => {
    const request = new NextRequest("http://localhost/editor/doc-1?from=share");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/sign-in?next=%2Feditor%2Fdoc-1%3Ffrom%3Dshare",
    );
  });

  it("allows authenticated editor requests", () => {
    const request = new NextRequest("http://localhost/editor/doc-1", {
      headers: {
        cookie: `${LOCAL_AUTH_COOKIE}=${LOCAL_AUTH_COOKIE_VALUE}`,
      },
    });
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("falls back to /editor for oversized next query redirect", () => {
    const longQuery = "q=".concat("a".repeat(3000));
    const request = new NextRequest(`http://localhost/editor/doc-1?${longQuery}`);
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in?next=%2Feditor");
  });
});
