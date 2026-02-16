import type { AIMessage } from "@/lib/types";
import { getRecentMessages } from "@/lib/ai/history";

describe("getRecentMessages", () => {
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
      { role: "assistant", content: "d" },
      { role: "user", content: "e" },
      { role: "assistant", content: "f" },
    ]);
  });

  it("returns empty for non-positive limits", () => {
    const recent = getRecentMessages([], 0);
    expect(recent).toEqual([]);
  });
});
