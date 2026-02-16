import { MAX_DOCUMENT_CONTENT_LENGTH } from "@/lib/ai/constraints";

export function isValidDocumentContentJson(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > MAX_DOCUMENT_CONTENT_LENGTH
  ) {
    return false;
  }

  try {
    const parsed = JSON.parse(value) as
      | { type?: unknown; content?: unknown }
      | unknown;
    const parsedType = readParsedDocumentContentField(parsed, "type");
    const parsedContent = readParsedDocumentContentField(parsed, "content");
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      parsedType === "doc" &&
      Array.isArray(parsedContent)
    );
  } catch {
    return false;
  }
}

function readParsedDocumentContentField(
  parsed: unknown,
  key: "type" | "content",
) {
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }

  try {
    return (parsed as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}
