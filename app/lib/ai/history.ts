import {
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_USER_ID_LENGTH,
} from "@/lib/ai/constraints";
import type { AIMessage } from "@/lib/types";
import {
  hasControlChars,
  hasDisallowedTextControlChars,
} from "@/lib/validators/controlChars";

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

function isValidHistoryMessage(message: unknown): message is AIMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const id = readHistoryField(message, "id");
  const userId = readHistoryField(message, "userId");
  const role = readHistoryField(message, "role");
  const content = readHistoryField(message, "content");
  const createdAt = readHistoryField(message, "createdAt");
  const normalizedId = typeof id === "string" ? id.trim() : "";
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
  const normalizedContent = typeof content === "string" ? content : "";

  return (
    normalizedId.length > 0 &&
    normalizedId.length <= MAX_USER_ID_LENGTH &&
    !hasControlChars(normalizedId) &&
    normalizedUserId.length > 0 &&
    normalizedUserId.length <= MAX_USER_ID_LENGTH &&
    !hasControlChars(normalizedUserId) &&
    normalizedContent.length > 0 &&
    normalizedContent.length <= MAX_MESSAGE_CONTENT_LENGTH &&
    !hasDisallowedTextControlChars(normalizedContent) &&
    typeof createdAt === "number" &&
    Number.isFinite(createdAt) &&
    createdAt >= 0 &&
    (role === "user" || role === "assistant")
  );
}

function readHistoryField(
  message: unknown,
  key: "id" | "userId" | "role" | "content" | "createdAt",
) {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  try {
    return (message as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}
