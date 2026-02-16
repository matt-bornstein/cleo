import { MAX_DOCUMENT_ID_LENGTH } from "@/lib/ai/constraints";

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

export function normalizeDocumentId(documentId: string) {
  return documentId.trim();
}

export function isValidDocumentId(documentId: string) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  return (
    normalizedDocumentId.length > 0 &&
    normalizedDocumentId.length <= MAX_DOCUMENT_ID_LENGTH &&
    !CONTROL_CHARS_REGEX.test(normalizedDocumentId)
  );
}
