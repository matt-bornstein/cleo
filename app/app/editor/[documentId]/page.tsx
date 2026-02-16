import { EditorShell } from "@/components/layout/EditorShell";

type EditorDocumentPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function EditorDocumentPage({
  params,
}: EditorDocumentPageProps) {
  const { documentId } = await params;
  return <EditorShell documentId={documentId} />;
}
