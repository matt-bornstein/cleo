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

  const candidate = message as {
    id?: unknown;
    userId?: unknown;
    role?: unknown;
    content?: unknown;
    createdAt?: unknown;
  };

  try {
    const normalizedId = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const normalizedUserId =
      typeof candidate.userId === "string" ? candidate.userId.trim() : "";
    const normalizedContent =
      typeof candidate.content === "string" ? candidate.content : "";

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
      typeof candidate.createdAt === "number" &&
      Number.isFinite(candidate.createdAt) &&
      candidate.createdAt >= 0 &&
      (candidate.role === "user" || candidate.role === "assistant")
    );
  } catch {
    return false;
  }
}
