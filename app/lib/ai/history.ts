import type { AIMessage } from "@/lib/types";

export function getRecentMessages(messages: AIMessage[], limit = 5) {
  if (!Array.isArray(messages)) {
    return [];
  }
  const safeLimit = Number.isFinite(limit) ? Math.floor(limit) : 0;
  if (safeLimit <= 0) return [];

  return messages
    .filter(isValidHistoryMessage)
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id)
        : a.createdAt - b.createdAt,
    )
    .slice(-safeLimit)
    .map((message) => ({
      role: message.role,
      content: message.content,
      userId: message.userId,
    }));
}

function isValidHistoryMessage(message: AIMessage): message is AIMessage {
  const normalizedId = typeof message.id === "string" ? message.id.trim() : "";
  const normalizedUserId =
    typeof message.userId === "string" ? message.userId.trim() : "";
  return (
    normalizedId.length > 0 &&
    normalizedUserId.length > 0 &&
    typeof message.content === "string" &&
    Number.isFinite(message.createdAt) &&
    message.createdAt >= 0 &&
    (message.role === "user" || message.role === "assistant")
  );
}
