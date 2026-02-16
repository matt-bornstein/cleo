import type { AIMessage } from "@/lib/types";

export function getRecentMessages(messages: AIMessage[], limit = 5) {
  if (limit <= 0) return [];
  return [...messages]
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id)
        : a.createdAt - b.createdAt,
    )
    .slice(-limit)
    .map((message) => ({
      role: message.role,
      content: message.content,
      userId: message.userId,
    }));
}
