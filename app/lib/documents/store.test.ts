import {
  createDocument,
  getDocumentById,
  listDocuments,
  resetDocumentsForTests,
  setDocumentChatClearedAt,
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
    expect(document.id).toBeTruthy();
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

  it("gets a document by id", () => {
    const created = createDocument("Roadmap");

    const fetched = getDocumentById(created.id);
    expect(fetched?.title).toBe("Roadmap");
  });

  it("updates document chatClearedAt timestamp", () => {
    const created = createDocument("Chat doc");
    const updated = setDocumentChatClearedAt(created.id, 1234);

    expect(updated?.chatClearedAt).toBe(1234);
    expect(getDocumentById(created.id)?.chatClearedAt).toBe(1234);
  });
});
