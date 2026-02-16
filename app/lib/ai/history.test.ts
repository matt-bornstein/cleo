import type { AIMessage } from "@/lib/types";
import { getRecentMessages } from "@/lib/ai/history";

describe("getRecentMessages", () => {
  it("returns empty for malformed non-array message containers", () => {
    expect(getRecentMessages(undefined as unknown as AIMessage[], 3)).toEqual([]);
    expect(getRecentMessages("oops" as unknown as AIMessage[], 3)).toEqual([]);
  });

  it("returns the most recent messages ordered by createdAt", () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        documentId: "doc-1",
        userId: "user-1",
        role: "user",
        content: "a",
        createdAt: 1,
      },
      {
        id: "2",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: "b",
        createdAt: 2,
      },
      {
        id: "3",
        documentId: "doc-1",
        userId: "user-1",
        role: "user",
        content: "c",
        createdAt: 3,
      },
      {
        id: "4",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: "d",
        createdAt: 4,
      },
      {
        id: "5",
        documentId: "doc-1",
        userId: "user-1",
        role: "user",
        content: "e",
        createdAt: 5,
      },
      {
        id: "6",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: "f",
        createdAt: 6,
      },
    ];

    const recent = getRecentMessages(messages, 3);

    expect(recent).toEqual([
      { role: "assistant", content: "d", userId: "user-1" },
      { role: "user", content: "e", userId: "user-1" },
      { role: "assistant", content: "f", userId: "user-1" },
    ]);
  });

  it("returns empty for non-positive limits", () => {
    const recent = getRecentMessages([], 0);
    expect(recent).toEqual([]);
  });

  it("returns empty for malformed non-finite limits", () => {
    const recent = getRecentMessages([], Number.NaN);
    expect(recent).toEqual([]);
  });

  it("uses deterministic id tie-breaker when timestamps are equal", () => {
    const messages: AIMessage[] = [
      {
        id: "b",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: "second",
        createdAt: 10,
      },
      {
        id: "a",
        documentId: "doc-1",
        userId: "user-1",
        role: "user",
        content: "first",
        createdAt: 10,
      },
    ];

    expect(getRecentMessages(messages, 2)).toEqual([
      { role: "user", content: "first", userId: "user-1" },
      { role: "assistant", content: "second", userId: "user-1" },
    ]);
  });

  it("filters malformed runtime history entries", () => {
    const messages = [
      {
        id: "valid",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: "ok",
        createdAt: 1,
      },
      {
        id: "",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: "bad id",
        createdAt: 2,
      },
      {
        id: "bad-created-at",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: "bad time",
        createdAt: -1,
      },
      {
        id: "bad-role",
        documentId: "doc-1",
        userId: "user-1",
        role: "system",
        content: "bad role",
        createdAt: 3,
      },
      {
        id: "bad-content",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: 123,
        createdAt: 4,
      },
      {
        id: "bad-content-control",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: "bad\u0000content",
        createdAt: 5,
      },
      {
        id: "bad-user-id-length",
        documentId: "doc-1",
        userId: "u".repeat(257),
        role: "assistant",
        content: "bad user id",
        createdAt: 6,
      },
    ] as unknown as AIMessage[];

    expect(getRecentMessages(messages, 5)).toEqual([
      { role: "assistant", content: "ok", userId: "user-1" },
    ]);
  });

  it("does not throw when history entries expose throwing getters", () => {
    const throwingEntry = {} as { id?: string };
    Object.defineProperty(throwingEntry, "id", {
      get() {
        throw new Error("id getter failed");
      },
    });

    const messages = [
      {
        id: "valid",
        documentId: "doc-1",
        userId: "user-1",
        role: "assistant",
        content: "ok",
        createdAt: 1,
      },
      throwingEntry,
    ] as unknown as AIMessage[];

    expect(() => getRecentMessages(messages, 5)).not.toThrow();
    expect(getRecentMessages(messages, 5)).toEqual([
      { role: "assistant", content: "ok", userId: "user-1" },
    ]);
  });
});
