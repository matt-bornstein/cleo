import { EditorShell } from "@/components/layout/EditorShell";

type EditorDocumentPageProps = {
  params: unknown;
};

export default async function EditorDocumentPage({
  params,
}: EditorDocumentPageProps) {
  const resolvedParams = await resolveParams(params);
  const documentId = normalizeRouteDocumentId(
    resolvedParams && typeof resolvedParams === "object"
      ? (resolvedParams as { documentId?: unknown }).documentId
      : undefined,
  );
  return <EditorShell documentId={documentId} />;
}

function normalizeRouteDocumentId(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

async function resolveParams(params: unknown) {
  if (!isThenable(params)) {
    return params;
  }

  try {
    return await params;
  } catch {
    return undefined;
  }
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    !!value &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
