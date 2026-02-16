import {
  createDocument,
  deleteDocument,
  getDocumentById,
  listDocuments,
  resetDocumentsForTests,
  setDocumentChatClearedAt,
  updateDocumentTitle,
} from "@/lib/documents/store";

describe("document store", () => {
  beforeEach(() => {
    resetDocumentsForTests();
    window.localStorage.clear();
  });

  it("creates documents with normalized titles", () => {
    const document = createDocument("  Product spec  ");

    expect(document.title).toBe("Product spec");
    expect(document.content).toContain('"type":"doc"');
    expect(document.ownerEmail).toBe("me@local.dev");
    expect(document.id).toBeTruthy();
  });

  it("falls back to default owner email for invalid owner input", () => {
    const blankOwner = createDocument("Blank owner", "   ");
    expect(blankOwner.ownerEmail).toBe("me@local.dev");

    const controlCharOwner = createDocument("Bad owner", "owner\nname@example.com");
    expect(controlCharOwner.ownerEmail).toBe("me@local.dev");
  });

  it("lists documents sorted by updatedAt desc and searchable", async () => {
    const first = createDocument("First");
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = createDocument("Second Plan");

    const all = listDocuments();
    expect(all.map((doc) => doc.id)).toEqual([second.id, first.id]);

    const filtered = listDocuments("plan");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(second.id);
  });

  it("normalizes legacy stored owner emails when loading from storage", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "legacy-doc",
            title: "Legacy",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "   ",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );

    const documents = listDocuments();
    expect(documents[0]?.ownerEmail).toBe("me@local.dev");
  });

  it("gets a document by id", () => {
    const created = createDocument("Roadmap");

    const fetched = getDocumentById(created.id);
    expect(fetched?.title).toBe("Roadmap");

    const padded = getDocumentById(`  ${created.id}  `);
    expect(padded?.id).toBe(created.id);
  });

  it("updates document chatClearedAt timestamp", () => {
    const created = createDocument("Chat doc");
    const updated = setDocumentChatClearedAt(created.id, 1234);

    expect(updated?.chatClearedAt).toBe(1234);
    expect(getDocumentById(created.id)?.chatClearedAt).toBe(1234);
  });

  it("deletes document by id", () => {
    const created = createDocument("Delete me");
    const removed = deleteDocument(created.id);
    expect(removed).toBe(true);
    expect(getDocumentById(created.id)).toBeUndefined();
  });

  it("rejects invalid document ids for document operations", () => {
    expect(getDocumentById("   ")).toBeUndefined();
    expect(updateDocumentTitle("   ", "Ignored")).toBeUndefined();
    expect(setDocumentChatClearedAt("doc-\ninvalid", 123)).toBeUndefined();
    expect(deleteDocument("doc-\ninvalid")).toBe(false);
  });

  it("updates document title and normalizes empty title", () => {
    const created = createDocument("Old title");
    const renamed = updateDocumentTitle(created.id, "  New title  ");
    expect(renamed?.title).toBe("New title");

    const untitled = updateDocumentTitle(created.id, "   ");
    expect(untitled?.title).toBe("Untitled");
  });
});
