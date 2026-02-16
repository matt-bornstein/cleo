import { POST } from "@/app/api/auth/local-signout/route";

describe("POST /api/auth/local-signout", () => {
  it("clears local auth cookie", async () => {
    const response = await POST();
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(response.headers.get("set-cookie")).toContain("plan00_local_auth=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
