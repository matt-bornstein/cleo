import { aiLockManager } from "@/lib/ai/lock";
import { POST } from "@/app/api/ai/stream/route";

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
});
