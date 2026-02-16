import { POST } from "@/app/api/auth/local-signin/route";
import {
  LOCAL_AUTH_COOKIE,
  LOCAL_AUTH_COOKIE_VALUE,
} from "@/lib/auth/session";

describe("POST /api/auth/local-signin", () => {
  it("falls back to /editor when request payload is malformed", async () => {
    const response = await POST({} as unknown as Request);
    const payload = (await response.json()) as { ok: boolean; next: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.next).toBe("/editor");
  });

  it("falls back to /editor when request json getter throws", async () => {
    const malformedRequest = Object.create(null) as { json: unknown };
    Object.defineProperty(malformedRequest, "json", {
      get() {
        throw new Error("json getter failed");
      },
    });

    const response = await POST(malformedRequest as unknown as Request);
    const payload = (await response.json()) as { ok: boolean; next: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.next).toBe("/editor");
  });

  it("falls back to /editor when payload next getter throws", async () => {
    const payloadWithThrowingNext = Object.create(null) as { next: unknown };
    Object.defineProperty(payloadWithThrowingNext, "next", {
      get() {
        throw new Error("next getter failed");
      },
    });

    const malformedRequest = {
      json: async () => payloadWithThrowingNext,
    } as unknown as Request;
    const response = await POST(malformedRequest);
    const payload = (await response.json()) as { ok: boolean; next: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.next).toBe("/editor");
  });

  it("sets local auth cookie and returns next path", async () => {
    const request = new Request("http://localhost/api/auth/local-signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ next: "/editor/abc" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { ok: boolean; next: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.next).toBe("/editor/abc");
    expect(response.headers.get("set-cookie")).toContain(
      `${LOCAL_AUTH_COOKIE}=${LOCAL_AUTH_COOKIE_VALUE}`,
    );
  });

  it("falls back to /editor when next path is invalid", async () => {
    const request = new Request("http://localhost/api/auth/local-signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ next: "https://evil.example.com" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { next: string };
    expect(payload.next).toBe("/editor");
  });

  it("rejects protocol-relative next paths", async () => {
    const request = new Request("http://localhost/api/auth/local-signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ next: "//evil.example.com" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { next: string };
    expect(payload.next).toBe("/editor");
  });

  it("falls back to /editor for non-string next payload values", async () => {
    const request = new Request("http://localhost/api/auth/local-signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ next: { path: "/editor/abc" } }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { next: string };
    expect(payload.next).toBe("/editor");
  });
});
