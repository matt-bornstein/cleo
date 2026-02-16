import { NextRequest } from "next/server";

import { middleware } from "@/middleware";

describe("middleware auth guard", () => {
  it("redirects unauthenticated editor requests to sign-in", () => {
    const request = new NextRequest("http://localhost/editor/doc-1");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in?next=%2Feditor%2Fdoc-1");
  });

  it("allows authenticated editor requests", () => {
    const request = new NextRequest("http://localhost/editor/doc-1", {
      headers: {
        cookie: "plan00_local_auth=1",
      },
    });
    const response = middleware(request);

    expect(response.status).toBe(200);
  });
});
