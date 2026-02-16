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

  it("releases lock after stream completion", async () => {
    const firstRequest = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "alice",
      },
      body: JSON.stringify(createRequestBody({ documentId: "doc-release" })),
    });

    const firstResponse = await POST(firstRequest);
    expect(firstResponse.status).toBe(200);
    await readStream(firstResponse);
    expect(aiLockManager.getStatus("doc-release")).toEqual({ locked: false });

    const secondRequest = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "bob",
      },
      body: JSON.stringify(createRequestBody({ documentId: "doc-release" })),
    });
    const secondResponse = await POST(secondRequest);
    expect(secondResponse.status).toBe(200);
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

  it("accepts payloads without messages array", async () => {
    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: "doc-no-messages",
        model: "gpt-4o",
        prompt: "Summarize",
        documentContent: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Initial" }] }],
        }),
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const events = await readStream(response);
    expect(events.some((event) => event.type === "done")).toBe(true);
  });

  it("returns bad request for empty required text fields", async () => {
    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: "   ",
        model: "gpt-4o",
        prompt: "",
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

  it("returns bad request for malformed messages payload", async () => {
    const invalidBodies = [
      {
        ...createRequestBody(),
        messages: { role: "user", content: "invalid" },
      },
      {
        ...createRequestBody(),
        messages: [{ role: "moderator", content: "invalid role" }],
      },
      {
        ...createRequestBody(),
        messages: [{ role: "user", content: "hello", userId: 123 }],
      },
    ];

    for (const body of invalidBodies) {
      const request = new Request("http://localhost/api/ai/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toBe("Invalid request payload");
    }
  });

  it("normalizes trimmed fields before lock lookup", async () => {
    aiLockManager.acquire("doc-trim", "alice");

    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "bob",
      },
      body: JSON.stringify(
        createRequestBody({
          documentId: "  doc-trim  ",
          model: "  gpt-4o  ",
          prompt: "  add summary  ",
        }),
      ),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("alice");
    aiLockManager.release("doc-trim", "alice");
  });

  it("normalizes blank user header to default lock identity", async () => {
    aiLockManager.acquire("doc-user-normalize", "local-dev-user");

    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "   ",
      },
      body: JSON.stringify(createRequestBody({ documentId: "doc-user-normalize" })),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await readStream(response);
    expect(aiLockManager.getStatus("doc-user-normalize")).toEqual({ locked: false });
  });
});

describe("GET /api/ai/stream", () => {
  it("requires documentId query parameter", async () => {
    const response = await GET(new Request("http://localhost/api/ai/stream"));
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("documentId is required");
  });

  it("requires non-empty documentId query parameter", async () => {
    const response = await GET(
      new Request("http://localhost/api/ai/stream?documentId=%20%20%20"),
    );
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("documentId is required");
  });

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
