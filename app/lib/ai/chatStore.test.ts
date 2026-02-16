import {
  listMessagesByDocument,
  resetMessagesForTests,
  saveMessage,
} from "@/lib/ai/chatStore";

describe("ai chat store", () => {
  beforeEach(() => {
    resetMessagesForTests();
    window.localStorage.clear();
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

    expect(invalidRole).toBeNull();
    expect(blankContent).toBeNull();
    expect(blankId).toBeNull();
    expect(listMessagesByDocument("doc-bad")).toEqual([]);
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
            id: "bad-doc",
            documentId: "doc-\ninvalid",
            userId: "u-1",
            role: "assistant",
            content: "Bad doc",
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
            id: "valid",
            documentId: "doc-legacy",
            userId: "u-2",
            role: "assistant",
            content: "Latest",
            createdAt: 5,
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
      }),
    );
  });
});
