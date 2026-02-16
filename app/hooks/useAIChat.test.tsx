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

function createRawStreamResponse(lines: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      lines.forEach((line) => {
        controller.enqueue(encoder.encode(line));
      });
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
        previousSnapshot: "<p>Original</p>",
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

  it("does not throw when onApplyContent callback is malformed non-function", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    createDiffMock.mockReturnValue({ id: "diff-non-function-apply" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          {
            type: "done",
            assistantMessage: "Applied update",
            nextContent: "<p>Updated</p>",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-non-function-apply",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: 123 as unknown as (nextContent: string) => void,
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Apply without callback");
    });

    expect(result.current.error).toBeNull();
    expect(createDiffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-non-function-apply",
      }),
    );
    expect(saveMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Applied update",
        diffId: "diff-non-function-apply",
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

  it("surfaces malformed stream payload errors", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createRawStreamResponse(["{\"type\":\"done\"}\n"]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-malformed-stream-payload",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Trigger malformed payload");
    });

    expect(result.current.error).toBe("Malformed AI stream event.");
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Error: Malformed AI stream event.",
      }),
    );
    expect(createDiffMock).not.toHaveBeenCalled();
    expect(saveMessageMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it("surfaces malformed done events with non-string nextContent payload", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createRawStreamResponse([
          JSON.stringify({
            type: "done",
            assistantMessage: "Invalid content",
            nextContent: 123,
          }) + "\n",
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-malformed-next-content",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Trigger malformed next content");
    });

    expect(result.current.error).toBe("Malformed AI stream event.");
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Error: Malformed AI stream event.",
      }),
    );
    expect(createDiffMock).not.toHaveBeenCalled();
    expect(saveMessageMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it("surfaces malformed stream json errors", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createRawStreamResponse(["not-json\n"]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-malformed-stream-json",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Trigger malformed json");
    });

    expect(result.current.error).toBe("Malformed AI stream event.");
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Error: Malformed AI stream event.",
      }),
    );
    expect(createDiffMock).not.toHaveBeenCalled();
    expect(saveMessageMock).toHaveBeenCalledTimes(2);

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

  it("falls back to default model when defaultModel is malformed non-string", () => {
    listMessagesByDocumentMock.mockReturnValue([]);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-model-malformed-default",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
        defaultModel: 123,
      }),
    );

    expect(result.current.selectedModel).toBe("gpt-4o");
    expect(getModelConfigMock).not.toHaveBeenCalledWith(123);
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

  it("falls back to default model when selected model update is malformed non-string", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-model-update-malformed",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      result.current.setSelectedModel(123 as unknown as string);
    });

    expect(result.current.selectedModel).toBe("gpt-4o");
    expect(getModelConfigMock).not.toHaveBeenCalledWith(123);
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

  it("falls back to default identity for malformed non-string current user ids", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    createDiffMock.mockReturnValue({ id: "diff-user-default" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          {
            type: "done",
            assistantMessage: "Applied fallback identity edit.",
            nextContent: "<p>Changed</p>",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-user-default",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: 123,
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Normalize identity fallback");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/stream",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-user-id": "local-dev-user",
        }),
      }),
    );
    expect(saveMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        role: "user",
        userId: "local-dev-user",
      }),
    );
    expect(createDiffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "local-dev-user",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("trims document id before chat history lookup and request payload", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    createDiffMock.mockReturnValue({ id: "diff-doc-trim" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          {
            type: "done",
            assistantMessage: "Applied using trimmed document id.",
            nextContent: "<p>Updated</p>",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "  doc-trim-id  ",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Apply update");
    });

    expect(listMessagesByDocumentMock).toHaveBeenCalledWith("doc-trim-id", undefined);

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      documentId: string;
    };
    expect(requestBody.documentId).toBe("doc-trim-id");
    expect(saveMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        documentId: "doc-trim-id",
      }),
    );
    expect(createDiffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-trim-id",
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

  it("rejects malformed non-string prompts without sending requests", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-bad-prompt-type",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt(123 as unknown as string);
    });

    expect(result.current.error).toBe("Prompt is required.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(saveMessageMock).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);

    vi.unstubAllGlobals();
  });

  it("rejects prompts when document id is blank after trimming", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "   ",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Help improve this");
    });

    expect(result.current.error).toBe("Document is unavailable.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(saveMessageMock).not.toHaveBeenCalled();
    expect(listMessagesByDocumentMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("rejects prompts when document id exceeds max length", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "d".repeat(257),
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Help improve this");
    });

    expect(result.current.error).toBe("Document is unavailable.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(saveMessageMock).not.toHaveBeenCalled();
    expect(listMessagesByDocumentMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("rejects prompts when document id contains control characters", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-\ninvalid",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Help improve this");
    });

    expect(result.current.error).toBe("Document is unavailable.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(saveMessageMock).not.toHaveBeenCalled();
    expect(listMessagesByDocumentMock).not.toHaveBeenCalled();

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

  it("rejects prompts containing disallowed control characters", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-control-prompt",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
      }),
    );

    await act(async () => {
      await result.current.sendPrompt(`bad${"\u0000"}prompt`);
    });

    expect(result.current.error).toBe("Prompt contains unsupported control characters.");
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

  it("does not throw when onClearChat callback is malformed non-function", () => {
    listMessagesByDocumentMock.mockReturnValue([]);

    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-clear-non-function",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
        onClearChat: 123 as unknown as (clearedAt: number) => void,
      }),
    );

    expect(() => {
      act(() => {
        result.current.clearChat();
      });
    }).not.toThrow();
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it("floors generated chat timestamps at zero when clock is negative", async () => {
    listMessagesByDocumentMock.mockReturnValue([]);
    createDiffMock.mockReturnValue({ id: "diff-negative-clock" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createStreamResponse([
          {
            type: "done",
            assistantMessage: "Applied edit.",
            nextContent: "<p>Updated</p>",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(-1000);

    const onClearChat = vi.fn();
    const { result } = renderHook(() =>
      useAIChat({
        documentId: "doc-negative-clock",
        currentDocumentContent: "<p>Original</p>",
        onApplyContent: vi.fn(),
        currentUserId: "owner@example.com",
        onClearChat,
      }),
    );

    await act(async () => {
      await result.current.sendPrompt("Apply update");
    });

    expect(saveMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        createdAt: 0,
      }),
    );
    expect(saveMessageMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        createdAt: 0,
      }),
    );

    await act(async () => {
      result.current.clearChat();
    });
    expect(onClearChat).toHaveBeenCalledWith(0);

    nowSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
