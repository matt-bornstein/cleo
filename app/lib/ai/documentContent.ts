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
    const parsed = JSON.parse(value) as { type?: unknown } | unknown;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      (parsed as { type?: unknown }).type === "doc"
    );
  } catch {
    return false;
  }
}
