import { aiLockManager } from "@/lib/ai/lock";
import { DEFAULT_AI_USER_ID } from "@/lib/ai/identity";
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
  it("returns bad request for malformed request object payload", async () => {
    const response = await POST({} as unknown as Request);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("Invalid request payload");
  });

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

  it("returns bad request for oversized document id in payload", async () => {
    const invalidDocumentIds = ["d".repeat(257), "doc-\ninvalid"];

    for (const documentId of invalidDocumentIds) {
      const request = new Request("http://localhost/api/ai/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          createRequestBody({
            documentId,
          }),
        ),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toBe("Invalid request payload");
    }
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

  it("returns bad request for unsupported model id", async () => {
    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        createRequestBody({
          model: "not-a-real-model",
        }),
      ),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("Invalid request payload");
  });

  it("returns bad request for invalid document content json", async () => {
    const invalidBodies = [
      createRequestBody({ documentContent: "" }),
      createRequestBody({ documentContent: "not-json" }),
      createRequestBody({ documentContent: JSON.stringify("not-an-object") }),
      createRequestBody({ documentContent: JSON.stringify({ type: "paragraph" }) }),
      createRequestBody({
        documentContent: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "a".repeat(200_001) }],
            },
          ],
        }),
      }),
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
      {
        ...createRequestBody(),
        messages: [{ role: "user", content: "hello", userId: "   " }],
      },
      {
        ...createRequestBody(),
        messages: [{ role: "assistant", content: "   ", userId: "assistant" }],
      },
      {
        ...createRequestBody(),
        messages: [
          { role: "assistant", content: `bad${"\u0000"}content`, userId: "assistant" },
        ],
      },
      {
        ...createRequestBody(),
        messages: [
          { role: "user", content: "hello", userId: "u".repeat(257) },
        ],
      },
      {
        ...createRequestBody(),
        messages: [{ role: "user", content: "hello", userId: "bob\nuser" }],
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

  it("returns bad request when message history exceeds limit", async () => {
    const oversizedMessages = Array.from({ length: 101 }, (_, index) => ({
      role: "user",
      content: `message-${index}`,
      userId: "alice@example.com",
    }));

    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        createRequestBody({
          messages: oversizedMessages,
        }),
      ),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("Invalid request payload");
  });

  it("returns bad request when prompt exceeds maximum length", async () => {
    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        createRequestBody({
          prompt: "a".repeat(4_001),
        }),
      ),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("Invalid request payload");
  });

  it("accepts multiline prompts but rejects disallowed prompt control characters", async () => {
    const multilineRequest = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        createRequestBody({
          prompt: "Line one\nLine two",
        }),
      ),
    });
    const multilineResponse = await POST(multilineRequest);
    expect(multilineResponse.status).toBe(200);

    const invalidControlPromptRequest = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        createRequestBody({
          prompt: `bad${"\u0000"}prompt`,
        }),
      ),
    });
    const invalidControlPromptResponse = await POST(invalidControlPromptRequest);
    expect(invalidControlPromptResponse.status).toBe(400);
    const payload = (await invalidControlPromptResponse.json()) as { error: string };
    expect(payload.error).toBe("Invalid request payload");
  });

  it("returns bad request when message content exceeds maximum length", async () => {
    const oversizedMessages = [
      {
        role: "user",
        content: "a".repeat(8_001),
        userId: "alice@example.com",
      },
    ];

    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        createRequestBody({
          messages: oversizedMessages,
        }),
      ),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("Invalid request payload");
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
    aiLockManager.acquire("doc-user-normalize", DEFAULT_AI_USER_ID);

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

  it("normalizes oversized user header to default lock identity", async () => {
    aiLockManager.acquire("doc-user-long", DEFAULT_AI_USER_ID);

    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "u".repeat(257),
      },
      body: JSON.stringify(createRequestBody({ documentId: "doc-user-long" })),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await readStream(response);
    expect(aiLockManager.getStatus("doc-user-long")).toEqual({ locked: false });
  });

  it("normalizes control-character user header to default lock identity", async () => {
    aiLockManager.acquire("doc-user-control", DEFAULT_AI_USER_ID);

    const request = new Request("http://localhost/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "alice\tadmin",
      },
      body: JSON.stringify(createRequestBody({ documentId: "doc-user-control" })),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await readStream(response);
    expect(aiLockManager.getStatus("doc-user-control")).toEqual({ locked: false });
  });
});

describe("GET /api/ai/stream", () => {
  it("returns bad request for malformed request url payload", async () => {
    const response = await GET({ url: 123 } as unknown as Request);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("documentId is required");
  });

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

  it("rejects oversized documentId query parameter", async () => {
    const invalidQueryDocumentIds = ["d".repeat(257), "doc-\ninvalid"];

    for (const documentId of invalidQueryDocumentIds) {
      const response = await GET(
        new Request(
          `http://localhost/api/ai/stream?documentId=${encodeURIComponent(documentId)}`,
        ),
      );
      expect(response.status).toBe(400);
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toBe("documentId is required");
    }
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

  it("trims documentId query before lock status lookup", async () => {
    aiLockManager.acquire("doc-status-trim", "alice");
    const response = await GET(
      new Request("http://localhost/api/ai/stream?documentId=%20doc-status-trim%20"),
    );
    const payload = (await response.json()) as { locked: boolean; lockedBy?: string };
    expect(payload.locked).toBe(true);
    expect(payload.lockedBy).toBe("alice");
    aiLockManager.release("doc-status-trim", "alice");
  });
});
