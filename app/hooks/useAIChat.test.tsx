import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useAIChat } from "@/hooks/useAIChat";

const {
  listMessagesByDocumentMock,
  saveMessageMock,
  createDiffMock,
  getModelConfigMock,
} = vi.hoisted(() => ({
  listMessagesByDocumentMock: vi.fn(),
  saveMessageMock: vi.fn(),
  createDiffMock: vi.fn(),
  getModelConfigMock: vi.fn(),
}));

vi.mock("@/lib/ai/chatStore", () => ({
  listMessagesByDocument: listMessagesByDocumentMock,
  saveMessage: saveMessageMock,
}));

vi.mock("@/lib/diffs/store", () => ({
  createDiff: createDiffMock,
}));

vi.mock("@/lib/ai/models", () => ({
  getModelConfig: getModelConfigMock,
}));

function createStreamResponse(
  events: Array<Record<string, unknown>>,
  options?: { trailingNewline?: boolean },
) {
  const trailingNewline = options?.trailingNewline ?? true;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      events.forEach((event, index) => {
        const isLast = index === events.length - 1;
        const suffix = trailingNewline || !isLast ? "\n" : "";
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}${suffix}`));
      });
      if (events.length === 0) {
        controller.enqueue(encoder.encode(""));
      }
      controller.close();
    },
  });

  return new Response(stream, { status: 200 });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolveFn) => {
    resolve = resolveFn;
  });
  return { promise, resolve };
}

describe("useAIChat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    listMessagesByDocumentMock.mockReset();
    saveMessageMock.mockReset();
    createDiffMock.mockReset();
    getModelConfigMock.mockReset();
    getModelConfigMock.mockImplementation((modelId: string) => {
      if (modelId === "unknown-model") {
        return { id: "gpt-4o", label: "GPT-4o" };
      }

      return {
        id: modelId || "gpt-4o",
        label: modelId || "GPT-4o",
      };
    });
  });

  it("submits request with user context and stores ai diff attribution", async () => {
    listMessagesByDocumentMock.mockReturnValue([
      {
        id: "m-1",
        documentId: "doc-1",
        userId: "teammate@example.com",
        role: "user",
        content: "Please simplify this intro",
        createdAt: 10,
      },
    ]);
    createDiffMock.mockReturnValue({ id: "diff-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          { type: "token", text: "Drafting..." },
          {
            type: "done",
            assistantMessage: "Applied improvements.",
            nextContent: "<p>Updated content</p>",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const onApplyContent = vi.fn();
    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-1",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent,
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Improve this section");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/stream",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-user-id": "owner@example.com" }),
      }),
    );

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ userId?: string }>;
    };
    expect(requestBody.messages[0]?.userId).toBe("teammate@example.com");

    expect(saveMessageMock).toHaveBeenCalledTimes(2);
    expect(saveMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        role: "user",
        userId: "owner@example.com",
      }),
    );
    expect(saveMessageMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        role: "assistant",
        userId: "assistant",
        diffId: "diff-1",
      }),
    );

    expect(createDiffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        userId: "owner@example.com",
        source: "ai",
      }),
    );
    expect(onApplyContent).toHaveBeenCalledWith("<p>Updated content</p>");

    vi.unstubAllGlobals();
  });

  it("skips diff creation when ai response keeps content unchanged", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          {
            type: "done",
            assistantMessage: "No edits needed.",
            nextContent: "<p>Original</p>",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-2",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Review this");
    });

    expect(createDiffMock).not.toHaveBeenCalled();
    expect(saveMessageMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "No edits needed.",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("parses final stream event without trailing newline", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    createDiffMock.mockReturnValue({ id: "diff-nl" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse(
          [
            {
              type: "done",
              assistantMessage: "Applied final event.",
              nextContent: "<p>Updated without newline</p>",
            },
          ],
          { trailingNewline: false },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const onApplyContent = vi.fn();
    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-3",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent,
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Apply with no newline");
    });

    expect(createDiffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-3",
        userId: "owner@example.com",
      }),
    );
    expect(saveMessageMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        content: "Applied final event.",
        diffId: "diff-nl",
      }),
    );
    expect(onApplyContent).toHaveBeenCalledWith("<p>Updated without newline</p>");

    vi.unstubAllGlobals();
  });

  it("surfaces final buffered error event without trailing newline", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse(
          [
            {
              type: "error",
              error: "Model failed",
            },
          ],
          { trailingNewline: false },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-error",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Trigger error");
    });

    expect(result.current.error).toBe("Model failed");
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Error: Model failed",
      }),
    );
    expect(createDiffMock).not.toHaveBeenCalled();
    expect(saveMessageMock).toHaveBeenCalledTimes(2);
    expect(saveMessageMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        role: "assistant",
        userId: "assistant",
        content: "Error: Model failed",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("normalizes unknown default model ids to known model config ids", () => {
    listMessagesByDocumentMock.mockReturnValue([]);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-model",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
        defaultModel: "unknown-model",
      }),
    );

    expect(getModelConfigMock).toHaveBeenCalledWith("unknown-model");
    expect(result.current.selectedModel).toBe("gpt-4o");
  });

  it("normalizes unknown selected model updates to known ids", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-model-update",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      result.current.setSelectedModel("unknown-model");
    });

    expect(result.current.selectedModel).toBe("gpt-4o");
  });

  it("normalizes whitespace current user id for headers and messages", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    createDiffMock.mockReturnValue({ id: "diff-user-normalized" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          {
            type: "done",
            assistantMessage: "Applied normalized id edit.",
            nextContent: "<p>Changed</p>",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-user-normalized",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "  owner@example.com  ",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Normalize identity");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/stream",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-user-id": "owner@example.com",
        }),
      }),
    );
    expect(saveMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        role: "user",
        userId: "owner@example.com",
      }),
    );
    expect(createDiffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "owner@example.com",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("rejects blank prompts without sending requests", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-empty-prompt",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("   ");
    });

    expect(result.current.error).toBe("Prompt is required.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(saveMessageMock).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);

    vi.unstubAllGlobals();
  });

  it("rejects oversized prompts without sending requests", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-oversized-prompt",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("a".repeat(4_001));
    });

    expect(result.current.error).toBe("Prompt must be 4,000 characters or less.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(saveMessageMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("trims prompt text before persistence and diff attribution", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    createDiffMock.mockReturnValue({ id: "diff-trim-prompt" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          {
            type: "done",
            assistantMessage: "Applied prompt trim edit.",
            nextContent: "<p>Updated</p>",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-trim-prompt",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("   polish this paragraph   ");
    });

    expect(saveMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        role: "user",
        content: "polish this paragraph",
      }),
    );
    expect(createDiffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        aiPrompt: "polish this paragraph",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("ignores duplicate prompt submissions while a request is in-flight", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    createDiffMock.mockReturnValue({ id: "diff-inflight" });
    const deferred = createDeferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(deferred.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-inflight",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    let firstRequest: Promise<void> = Promise.resolve();
    let secondRequest: Promise<void> = Promise.resolve();
    await act(async () => {
      firstRequest = result.current.sendPrompt("First request");
      secondRequest = result.current.sendPrompt("Second request");
    });

    deferred.resolve(
      createStreamResponse([
        {
          type: "done",
          assistantMessage: "Handled once.",
          nextContent: "<p>Updated</p>",
        },
      ]),
    );

    await act(async () => {
      await Promise.all([firstRequest, secondRequest]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saveMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        role: "user",
        content: "First request",
      }),
    );
    expect(saveMessageMock.mock.calls.some((call) => call[0]?.content === "Second request")).toBe(
      false,
    );

    vi.unstubAllGlobals();
  });

  it("clears visible errors when chat history is cleared", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse(
          [
            {
              type: "error",
              error: "Temporary failure",
            },
          ],
          { trailingNewline: false },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const onClearChat = vi.fn();
    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-clear",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
        onClearChat,
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Trigger failure");
    });
    expect(result.current.error).toBe("Temporary failure");

    await act(async () => {
      result.current.clearChat();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(onClearChat).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
