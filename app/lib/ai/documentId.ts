import { MAX_DOCUMENT_ID_LENGTH } from "@/lib/ai/constraints";
import { hasControlChars } from "@/lib/validators/controlChars";

export function normalizeDocumentId(documentId: string) {
  return documentId.trim();
}

export function isValidDocumentId(documentId: string) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  return (
    normalizedDocumentId.length > 0 &&
    normalizedDocumentId.length <= MAX_DOCUMENT_ID_LENGTH &&
    !hasControlChars(normalizedDocumentId)
  );
}
