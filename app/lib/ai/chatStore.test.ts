import {
  listMessagesByDocument,
  resetMessagesForTests,
  saveMessage,
} from "@/lib/ai/chatStore";
import { DEFAULT_AI_USER_ID } from "@/lib/ai/identity";
import * as aiModels from "@/lib/ai/models";
import { vi } from "vitest";

function safeClearLocalStorage() {
  try {
    window.localStorage.clear();
  } catch {
    return;
  }
}

describe("ai chat store", () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "localStorage",
  );

  beforeEach(() => {
    vi.restoreAllMocks();
    if (localStorageDescriptor) {
      Object.defineProperty(window, "localStorage", localStorageDescriptor);
    }
    resetMessagesForTests();
    safeClearLocalStorage();
  });

  it("saves and lists document-scoped messages", () => {
    saveMessage({
      id: "m-1",
      documentId: "doc-1",
      userId: "u-1",
      role: "user",
      content: "Hello",
      createdAt: 100,
    });
    saveMessage({
      id: "m-2",
      documentId: "doc-2",
      userId: "u-1",
      role: "assistant",
      content: "Hi",
      createdAt: 101,
    });

    expect(listMessagesByDocument("doc-1")).toHaveLength(1);
    expect(listMessagesByDocument("doc-1")[0].id).toBe("m-1");
  });

  it("filters messages older than provided chatClearedAt", () => {
    saveMessage({
      id: "m-3",
      documentId: "doc-clear",
      userId: "u-1",
      role: "user",
      content: "Before clear",
      createdAt: 500,
    });
    saveMessage({
      id: "m-4",
      documentId: "doc-clear",
      userId: "u-1",
      role: "assistant",
      content: "After clear",
      createdAt: 2_100,
    });

    const visible = listMessagesByDocument("doc-clear", 2_000);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe("m-4");
  });

  it("ignores malformed chatClearedAt values when filtering", () => {
    saveMessage({
      id: "m-nan",
      documentId: "doc-clear-invalid",
      userId: "u-1",
      role: "assistant",
      content: "Message should remain visible",
      createdAt: 100,
    });

    const visible = listMessagesByDocument("doc-clear-invalid", Number.NaN);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe("m-nan");

    const visibleWithNegative = listMessagesByDocument("doc-clear-invalid", -10);
    expect(visibleWithNegative).toHaveLength(1);
    expect(visibleWithNegative[0].id).toBe("m-nan");
  });

  it("uses deterministic id tie-breaker for same-timestamp messages", () => {
    saveMessage({
      id: "m-b",
      documentId: "doc-sort",
      userId: "u-1",
      role: "assistant",
      content: "Second",
      createdAt: 100,
    });
    saveMessage({
      id: "m-a",
      documentId: "doc-sort",
      userId: "u-1",
      role: "assistant",
      content: "First",
      createdAt: 100,
    });

    expect(listMessagesByDocument("doc-sort").map((message) => message.id)).toEqual([
      "m-a",
      "m-b",
    ]);
  });

  it("normalizes document ids and rejects invalid document ids", () => {
    const saved = saveMessage({
      id: "m-5",
      documentId: "  doc-normalized  ",
      userId: "u-1",
      role: "user",
      content: "Hello",
      createdAt: 3_000,
    });
    expect(saved?.documentId).toBe("doc-normalized");
    expect(listMessagesByDocument("doc-normalized")).toHaveLength(1);

    const rejected = saveMessage({
      id: "m-6",
      documentId: "   ",
      userId: "u-1",
      role: "assistant",
      content: "Invalid doc",
      createdAt: 3_100,
    });
    expect(rejected).toBeNull();
    expect(listMessagesByDocument("   ")).toEqual([]);
  });

  it("returns empty list for malformed non-string document ids", () => {
    saveMessage({
      id: "m-non-string-doc-id",
      documentId: "doc-valid",
      userId: "u-1",
      role: "assistant",
      content: "Hello",
      createdAt: 4_000,
    });

    expect(listMessagesByDocument(123 as unknown as string)).toEqual([]);
  });

  it("rejects malformed saveMessage payloads", () => {
    const invalidRole = saveMessage({
      id: "msg-invalid-role",
      documentId: "doc-bad",
      userId: "author",
      role: "moderator" as never,
      content: "Hello",
      createdAt: Date.now(),
    });
    const blankContent = saveMessage({
      id: "msg-blank-content",
      documentId: "doc-bad",
      userId: "author",
      role: "user",
      content: "   ",
      createdAt: Date.now(),
    });
    const blankId = saveMessage({
      id: "   ",
      documentId: "doc-bad",
      userId: "author",
      role: "assistant",
      content: "Hello",
      createdAt: Date.now(),
    });
    const controlCharId = saveMessage({
      id: "msg-\ncontrol",
      documentId: "doc-bad",
      userId: "author",
      role: "assistant",
      content: "Hello",
      createdAt: Date.now(),
    });
    const oversizedId = saveMessage({
      id: "m".repeat(257),
      documentId: "doc-bad",
      userId: "author",
      role: "assistant",
      content: "Hello",
      createdAt: Date.now(),
    });
    const oversizedContent = saveMessage({
      id: "msg-oversized-content",
      documentId: "doc-bad",
      userId: "author",
      role: "assistant",
      content: "a".repeat(8_001),
      createdAt: Date.now(),
    });
    const controlCharContent = saveMessage({
      id: "msg-control-content",
      documentId: "doc-bad",
      userId: "author",
      role: "assistant",
      content: `bad${"\u0000"}content`,
      createdAt: Date.now(),
    });
    const negativeTimestamp = saveMessage({
      id: "msg-negative-time",
      documentId: "doc-bad",
      userId: "author",
      role: "assistant",
      content: "Hello",
      createdAt: -1,
    });
    const nonObjectPayload = saveMessage(42 as unknown as never);

    expect(invalidRole).toBeNull();
    expect(blankContent).toBeNull();
    expect(blankId).toBeNull();
    expect(controlCharId).toBeNull();
    expect(oversizedId).toBeNull();
    expect(oversizedContent).toBeNull();
    expect(controlCharContent).toBeNull();
    expect(negativeTimestamp).toBeNull();
    expect(nonObjectPayload).toBeNull();
    expect(listMessagesByDocument("doc-bad")).toEqual([]);
  });

  it("handles saveMessage payload getter traps safely", () => {
    const payloadWithThrowingRequiredField = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(payloadWithThrowingRequiredField, "id", {
      get() {
        throw new Error("id getter failed");
      },
    });
    Object.defineProperty(payloadWithThrowingRequiredField, "documentId", {
      value: "doc-getter-trap",
    });
    Object.defineProperty(payloadWithThrowingRequiredField, "role", {
      value: "assistant",
    });
    Object.defineProperty(payloadWithThrowingRequiredField, "content", {
      value: "Hello",
    });
    Object.defineProperty(payloadWithThrowingRequiredField, "createdAt", {
      value: 1,
    });

    expect(
      saveMessage(
        payloadWithThrowingRequiredField as unknown as Parameters<typeof saveMessage>[0],
      ),
    ).toBeNull();

    const payloadWithThrowingOptionalFields = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(payloadWithThrowingOptionalFields, "id", {
      value: "getter-safe-message",
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "documentId", {
      value: "doc-getter-safe",
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "role", {
      value: "assistant",
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "content", {
      value: "Hello",
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "createdAt", {
      value: 2,
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "userId", {
      get() {
        throw new Error("userId getter failed");
      },
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "model", {
      get() {
        throw new Error("model getter failed");
      },
    });

    const saved = saveMessage(
      payloadWithThrowingOptionalFields as unknown as Parameters<typeof saveMessage>[0],
    );
    expect(saved).not.toBeNull();
    expect(saved?.id).toBe("getter-safe-message");
    expect(saved?.userId).toBe(DEFAULT_AI_USER_ID);
    expect(saved?.model).toBeUndefined();
  });

  it("does not fail when save payload includes enumerable getter traps", () => {
    const payloadWithThrowingExtraField = {
      id: "message-extra-getter",
      documentId: "doc-extra-getter",
      userId: "owner@example.com",
      role: "assistant",
      content: "Hello",
      createdAt: 3,
    } as Record<string, unknown>;
    Object.defineProperty(payloadWithThrowingExtraField, "extra", {
      enumerable: true,
      get() {
        throw new Error("extra getter failed");
      },
    });

    expect(() =>
      saveMessage(
        payloadWithThrowingExtraField as unknown as Parameters<typeof saveMessage>[0],
      ),
    ).not.toThrow();
    expect(listMessagesByDocument("doc-extra-getter")).toEqual([
      expect.objectContaining({
        id: "message-extra-getter",
        content: "Hello",
      }),
    ]);
  });

  it("normalizes unknown message model ids to supported defaults", () => {
    const saved = saveMessage({
      id: "model-message",
      documentId: "doc-model",
      userId: "author",
      role: "assistant",
      content: "Response",
      model: "unknown-model-id",
      createdAt: Date.now(),
    });

    expect(saved?.model).toBe("gpt-4o");
    expect(listMessagesByDocument("doc-model")[0]?.model).toBe("gpt-4o");
  });

  it("drops message model metadata when model lookup throws", () => {
    vi.spyOn(aiModels, "getModelConfig").mockImplementation(() => {
      throw new Error("model lookup failed");
    });

    const saved = saveMessage({
      id: "model-message-throw",
      documentId: "doc-model-throw",
      userId: "author",
      role: "assistant",
      content: "Response",
      model: "gpt-4o",
      createdAt: Date.now(),
    });

    expect(saved?.model).toBeUndefined();
    expect(listMessagesByDocument("doc-model-throw")[0]?.model).toBeUndefined();
  });

  it("filters malformed persisted messages on load", () => {
    window.localStorage.setItem(
      "plan00.aiMessages.v1",
      JSON.stringify({
        messages: [
          {
            id: "valid",
            documentId: "  doc-legacy  ",
            userId: "  USER@example.com  ",
            role: "assistant",
            content: "Hello",
            createdAt: 1,
          },
          {
            id: "",
            documentId: "doc-legacy",
            userId: "u-1",
            role: "assistant",
            content: "Bad id",
            createdAt: 2,
          },
          {
            id: 123,
            documentId: "doc-legacy",
            userId: "u-1",
            role: "assistant",
            content: "Numeric id",
            createdAt: 2,
          },
          {
            id: "bad-doc",
            documentId: "doc-\ninvalid",
            userId: "u-1",
            role: "assistant",
            content: "Bad doc",
            createdAt: 3,
          },
          {
            id: "bad\nid",
            documentId: "doc-legacy",
            userId: "u-1",
            role: "assistant",
            content: "Bad id",
            createdAt: 3,
          },
          {
            id: "m".repeat(257),
            documentId: "doc-legacy",
            userId: "u-1",
            role: "assistant",
            content: "Bad long id",
            createdAt: 3,
          },
          {
            id: "bad-role",
            documentId: "doc-legacy",
            userId: "u-1",
            role: "moderator",
            content: "Bad role",
            createdAt: 4,
          },
          {
            id: "bad-time",
            documentId: "doc-legacy",
            userId: "u-1",
            role: "assistant",
            content: "Bad time",
            createdAt: -1,
          },
          {
            id: "bad-content",
            documentId: "doc-legacy",
            userId: "u-1",
            role: "assistant",
            content: "a".repeat(8_001),
            createdAt: 4,
          },
          null,
          {
            id: "bad-control-content",
            documentId: "doc-legacy",
            userId: "u-1",
            role: "assistant",
            content: `bad${"\u0000"}content`,
            createdAt: 4,
          },
          {
            id: "valid",
            documentId: "doc-legacy",
            userId: "u-2",
            role: "assistant",
            content: "Latest",
            model: "unknown-model-id",
            createdAt: 5,
          },
          {
            id: "valid",
            documentId: "doc-legacy",
            userId: "u-3",
            role: "assistant",
            content: "Stale but later in array",
            createdAt: 0,
          },
        ],
      }),
    );

    const messages = listMessagesByDocument("doc-legacy");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(
      expect.objectContaining({
        id: "valid",
        documentId: "doc-legacy",
        userId: "u-2",
        content: "Latest",
        model: "gpt-4o",
      }),
    );
  });

  it("returns empty when persisted chat payload has non-array messages container", () => {
    window.localStorage.setItem(
      "plan00.aiMessages.v1",
      JSON.stringify({ messages: { id: "not-array" } }),
    );

    expect(listMessagesByDocument("doc-legacy")).toEqual([]);
  });

  it("dedupes duplicate message ids on save by newest timestamp", () => {
    const first = saveMessage({
      id: "msg-dedupe",
      documentId: "doc-dedupe",
      userId: "u-1",
      role: "assistant",
      content: "First",
      createdAt: 10,
    });
    const stale = saveMessage({
      id: "msg-dedupe",
      documentId: "doc-dedupe",
      userId: "u-1",
      role: "assistant",
      content: "Stale",
      createdAt: 9,
    });
    const newer = saveMessage({
      id: "msg-dedupe",
      documentId: "doc-dedupe",
      userId: "u-1",
      role: "assistant",
      content: "Newer",
      createdAt: 11,
    });

    expect(first?.content).toBe("First");
    expect(stale?.content).toBe("First");
    expect(newer?.content).toBe("Newer");
    expect(listMessagesByDocument("doc-dedupe")).toEqual([
      expect.objectContaining({
        id: "msg-dedupe",
        content: "Newer",
        createdAt: 11,
      }),
    ]);
  });

  it("falls back to in-memory messages when localStorage getter throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("localStorage getter failed");
      },
    });

    const saved = saveMessage({
      id: "memory-message",
      documentId: "doc-memory",
      userId: "u-1",
      role: "assistant",
      content: "Memory content",
      createdAt: 10,
    });

    expect(saved).not.toBeNull();
    expect(listMessagesByDocument("doc-memory")).toEqual([
      expect.objectContaining({
        id: "memory-message",
      }),
    ]);
  });

  it("returns empty list when localStorage getItem throws", () => {
    saveMessage({
      id: "getitem-message",
      documentId: "doc-getitem",
      userId: "u-1",
      role: "assistant",
      content: "Stored content",
      createdAt: 10,
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("getItem failed");
    });

    expect(listMessagesByDocument("doc-getitem")).toEqual([]);
  });

  it("returns normalized saves when localStorage setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("setItem failed");
    });

    const saved = saveMessage({
      id: " setitem-message ",
      documentId: " doc-setitem ",
      userId: "u-1",
      role: "assistant",
      content: "Stored content",
      model: "unknown-model-id",
      createdAt: 10,
    });

    expect(saved).toEqual(
      expect.objectContaining({
        id: "setitem-message",
        documentId: "doc-setitem",
        model: "gpt-4o",
      }),
    );
  });
});
