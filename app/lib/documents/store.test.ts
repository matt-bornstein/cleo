import {
  createDocument,
  deleteDocument,
  getDocumentById,
  listDocuments,
  resetDocumentsForTests,
  setDocumentChatClearedAt,
  updateDocumentTitle,
} from "@/lib/documents/store";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";

describe("document store", () => {
  beforeEach(() => {
    resetDocumentsForTests();
    window.localStorage.clear();
  });

  it("creates documents with normalized titles", () => {
    const document = createDocument("  Product spec  ");

    expect(document.title).toBe("Product spec");
    expect(document.content).toContain('"type":"doc"');
    expect(document.ownerEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);
    expect(document.id).toBeTruthy();
  });

  it("falls back to default owner email for invalid owner input", () => {
    const blankOwner = createDocument("Blank owner", "   ");
    expect(blankOwner.ownerEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);

    const controlCharOwner = createDocument("Bad owner", "owner\nname@example.com");
    expect(controlCharOwner.ownerEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);
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

  it("uses deterministic id tie-breaker for equal updatedAt timestamps", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "doc-b",
            title: "Doc B",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "owner@example.com",
            createdAt: 1,
            updatedAt: 10,
          },
          {
            id: "doc-a",
            title: "Doc A",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "owner@example.com",
            createdAt: 1,
            updatedAt: 10,
          },
        ],
      }),
    );

    expect(listDocuments().map((document) => document.id)).toEqual(["doc-a", "doc-b"]);
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
    expect(documents[0]?.ownerEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);
  });

  it("filters malformed persisted documents and normalizes legacy fields", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "  doc-legacy  ",
            title: "   ",
            content: "not-json",
            ownerEmail: " USER@EXAMPLE.COM ",
            createdAt: "1",
            updatedAt: 2,
            lastDiffAt: "bad",
            chatClearedAt: 10,
          },
          {
            id: "doc-\ninvalid",
            title: "Bad id",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "user@example.com",
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "doc-legacy",
            title: "Latest title",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "latest@example.com",
            createdAt: 20,
            updatedAt: 30,
          },
        ],
      }),
    );

    const documents = listDocuments();
    expect(documents).toHaveLength(1);
    expect(documents[0]).toEqual(
      expect.objectContaining({
        id: "doc-legacy",
        title: "Latest title",
        ownerEmail: "latest@example.com",
        content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
        lastDiffAt: undefined,
        chatClearedAt: undefined,
      }),
    );
    expect(documents[0].createdAt).toBe(20);
    expect(documents[0].updatedAt).toBeGreaterThanOrEqual(documents[0].createdAt);
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
