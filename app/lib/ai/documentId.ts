import { MAX_DOCUMENT_ID_LENGTH } from "@/lib/ai/constraints";
import { hasControlChars } from "@/lib/validators/controlChars";

export function normalizeDocumentId(documentId: unknown) {
  return typeof documentId === "string" ? documentId.trim() : "";
}

export function isValidDocumentId(documentId: unknown) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  return (
    normalizedDocumentId.length > 0 &&
    normalizedDocumentId.length <= MAX_DOCUMENT_ID_LENGTH &&
    !hasControlChars(normalizedDocumentId)
  );
}
