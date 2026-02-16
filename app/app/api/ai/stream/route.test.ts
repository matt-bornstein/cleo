import { aiLockManager } from "@/lib/ai/lock";
import { GET, POST } from "@/app/api/ai/stream/route";

function createRequestBody(overrides?: Partial<Record<string, unknown>>) {
  return {
    documentId: "doc-test",
    model: "gpt-4o",
    prompt: "Add a short sentence",
    documentContent: JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Initial" }] }],
    }),
    messages: [],
    ...overrides,
  };
}

async function readStream(response: Response) {
  const text = await response.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("POST /api/ai/stream", () => {
  it("streams tokens and done payload", async () => {
    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createRequestBody()),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const events = await readStream(response);
    expect(events.some((event) => event.type === "token")).toBe(true);
    expect(events.some((event) => event.type === "done")).toBe(true);

    const doneEvent = events.find((event) => event.type === "done");
    expect(doneEvent).toBeDefined();
    expect(String(doneEvent?.assistantMessage)).toContain(
      "Keeping the current document unchanged",
    );
    expect(String(doneEvent?.nextContent)).toContain("Initial");
  });

  it("returns busy error when lock is already held", async () => {
    aiLockManager.acquire("doc-lock", "alice");

    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "bob",
      },
      body: JSON.stringify(createRequestBody({ documentId: "doc-lock" })),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("alice");
    aiLockManager.release("doc-lock", "alice");
  });

  it("returns bad request for invalid payload", async () => {
    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        prompt: "missing documentId",
        documentContent: "{}",
        messages: [],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("Invalid request payload");
  });

  it("returns bad request for non-json request body", async () => {
    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{not-json}",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("Invalid request payload");
  });
});

describe("GET /api/ai/stream", () => {
  it("returns unlocked status by default", async () => {
    const response = await GET(
      new Request("http://localhost/api/ai/stream?documentId=doc-status"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { locked: boolean };
    expect(payload.locked).toBe(false);
  });

  it("returns lock owner when locked", async () => {
    aiLockManager.acquire("doc-status-locked", "alice");
    const response = await GET(
      new Request("http://localhost/api/ai/stream?documentId=doc-status-locked"),
    );
    const payload = (await response.json()) as { locked: boolean; lockedBy?: string };
    expect(payload.locked).toBe(true);
    expect(payload.lockedBy).toBe("alice");
    aiLockManager.release("doc-status-locked", "alice");
  });
});
