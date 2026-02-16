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

  it("handles nextUrl getter errors safely", () => {
    const requestWithThrowingNextUrl = Object.create(null) as { nextUrl: unknown };
    Object.defineProperty(requestWithThrowingNextUrl, "nextUrl", {
      get() {
        throw new Error("nextUrl getter failed");
      },
    });

    const response = middleware(requestWithThrowingNextUrl as unknown as NextRequest);
    expect(response.status).toBe(200);
  });

  it("falls back to localhost base when request url getter throws", () => {
    const malformedRequest = {
      nextUrl: {
        pathname: "/editor/doc-1",
        search: "?from=share",
      },
      cookies: {
        get: () => undefined,
      },
    } as {
      nextUrl: { pathname: string; search: string };
      cookies: { get: (key: string) => undefined };
      url?: string;
    };
    Object.defineProperty(malformedRequest, "url", {
      get() {
        throw new Error("url getter failed");
      },
    });

    const response = middleware(malformedRequest as unknown as NextRequest);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "http://localhost/sign-in?next=%2Feditor%2Fdoc-1%3Ffrom%3Dshare",
    );
  });

  it("falls back to localhost base when request url is malformed", () => {
    const malformedRequest = {
      url: "not a valid absolute url",
      nextUrl: {
        pathname: "/editor/doc-1",
        search: "?from=share",
      },
      cookies: {
        get: () => undefined,
      },
    } as unknown as NextRequest;

    const response = middleware(malformedRequest);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "http://localhost/sign-in?next=%2Feditor%2Fdoc-1%3Ffrom%3Dshare",
    );
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

  it("ignores cookie getter failures when checking auth cookie", () => {
    const malformedRequest = {
      url: "http://localhost/editor/doc-1",
      nextUrl: {
        pathname: "/editor/doc-1",
        search: "",
      },
    } as {
      url: string;
      nextUrl: { pathname: string; search: string };
      cookies?: unknown;
    };
    Object.defineProperty(malformedRequest, "cookies", {
      get() {
        throw new Error("cookies getter failed");
      },
    });

    const response = middleware(malformedRequest as unknown as NextRequest);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in?next=%2Feditor%2Fdoc-1");
  });
});
