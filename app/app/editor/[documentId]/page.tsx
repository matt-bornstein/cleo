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
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

async function resolveParams(params: unknown) {
  if (!isThenable(params)) {
    if (hasThenProperty(params)) {
      return undefined;
    }
    return params;
  }

  try {
    return await params;
  } catch {
    return undefined;
  }
}

function hasThenProperty(value: unknown) {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return false;
  }

  try {
    return "then" in value;
  } catch {
    return true;
  }
}

function isThenable(value: unknown): value is Promise<unknown> {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return false;
  }

  try {
    if (!("then" in value)) {
      return false;
    }

    return typeof (value as { then?: unknown }).then === "function";
  } catch {
    return false;
  }
}
